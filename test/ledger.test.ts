import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type Ledger,
  dueDate,
  findRequest,
  loadLedger,
  markSent,
  overdue,
  recordReply,
  saveLedger,
} from "../src/ledger.ts";

const tmpLedger = () => join(mkdtempSync(join(tmpdir(), "ledger-")), "ledger.json");

describe("ledger", () => {
  it("is empty when the file does not exist yet", () => {
    expect(loadLedger(tmpLedger())).toEqual({ entries: [] });
  });

  it("round-trips through the file", () => {
    const path = tmpLedger();
    const ledger: Ledger = {
      entries: [
        {
          broker: "broker-a",
          state: "acknowledged",
          reference: "BA-482915",
          dates: { drafted: "2026-10-01", sent: "2026-10-02", due: "2026-11-02", replied: "2026-10-20" },
        },
      ],
    };
    saveLedger(path, ledger);
    expect(loadLedger(path)).toEqual(ledger);
  });

  it("rejects an entry with an unknown state", () => {
    const path = tmpLedger();
    saveLedger(path, { entries: [{ broker: "broker-a", state: "lost" as never, dates: { drafted: "2026-10-01" } }] });
    expect(() => loadLedger(path)).toThrow(/state "lost" is not one of/);
  });

  it.each(["overdue", "escalated"])("rejects a stored %s state, naming the entry and the valid states", (state) => {
    const path = tmpLedger();
    writeFileSync(path, JSON.stringify({ entries: [{ broker: "broker-a", state, dates: { sent: "2026-10-01" } }] }));
    expect(() => loadLedger(path)).toThrow(
      `${path}: entry 0 (broker-a): state "${state}" is not one of drafted, sent, acknowledged`,
    );
  });

  it("rejects the old dates.acknowledged, naming the entry", () => {
    const path = tmpLedger();
    writeFileSync(
      path,
      JSON.stringify({ entries: [{ broker: "broker-a", state: "acknowledged", dates: { acknowledged: "2026-10-20" } }] }),
    );
    expect(() => loadLedger(path)).toThrow(`${path}: entry 0 (broker-a): dates.acknowledged is not a ledger date`);
  });

  it("rejects a reference that is not a string", () => {
    const path = tmpLedger();
    writeFileSync(path, JSON.stringify({ entries: [{ broker: "broker-a", state: "sent", reference: 7, dates: {} }] }));
    expect(() => loadLedger(path)).toThrow(`${path}: entry 0 (broker-a): reference must be a string`);
  });

  it("rejects an entry without dates, naming the file and the entry", () => {
    const path = tmpLedger();
    writeFileSync(path, JSON.stringify({ entries: [{ broker: "broker-a", state: "sent" }] }));
    expect(() => loadLedger(path)).toThrow(`${path}: entry 0 (broker-a): expected a "dates" object`);
  });

  it("rejects a date that is not YYYY-MM-DD", () => {
    const path = tmpLedger();
    writeFileSync(path, JSON.stringify({ entries: [{ broker: "broker-a", state: "sent", dates: { due: "12/10/2026" } }] }));
    expect(() => loadLedger(path)).toThrow(`${path}: entry 0 (broker-a): dates.due "12/10/2026" is not a YYYY-MM-DD date`);
  });

  it("names the file when it is not valid JSON", () => {
    const path = tmpLedger();
    writeFileSync(path, "{ entries: ");
    expect(() => loadLedger(path)).toThrow(`${path}: not valid JSON`);
  });
});

describe("request lifecycle", () => {
  const ledger = (): Ledger => ({
    entries: [
      { broker: "broker-a", state: "acknowledged", dates: { sent: "2026-08-01", due: "2026-09-01", replied: "2026-08-20" } },
      { broker: "broker-a", state: "drafted", dates: { drafted: "2026-10-12" } },
      { broker: "broker-b", state: "sent", dates: { sent: "2026-10-01", due: "2026-11-01" } },
    ],
  });

  it("finds a broker's request in one of the given states", () => {
    const l = ledger();
    expect(findRequest(l, "broker-a", ["drafted", "sent"])).toBe(l.entries[1]);
    expect(findRequest(l, "broker-b", ["drafted"])).toBeUndefined();
  });

  it("marks a request sent with its reference, sent date and due date", () => {
    const entry = ledger().entries[1];
    markSent(entry, "BA-482915", "2027-01-31");
    expect(entry).toEqual({
      broker: "broker-a",
      state: "sent",
      reference: "BA-482915",
      dates: { drafted: "2026-10-12", sent: "2027-01-31", due: "2027-03-01" },
    });
  });

  it("records a reply", () => {
    const entry = ledger().entries[2];
    recordReply(entry, "2026-10-20");
    expect(entry).toMatchObject({ state: "acknowledged", dates: { replied: "2026-10-20" } });
  });
});

describe("dueDate", () => {
  it.each([
    ["ordinary month", "2026-10-12", "2026-11-12"],
    ["shorter next month", "2026-08-31", "2026-09-30"],
    ["leap year", "2028-01-30", "2028-02-29"],
    ["leap year, clamped", "2028-01-31", "2028-02-29"],
    ["year boundary", "2026-12-15", "2027-01-15"],
    ["due date on a Saturday (2026-11-14) moves to Monday", "2026-10-14", "2026-11-16"],
    ["due date on a Sunday (2026-11-15) moves to Monday", "2026-10-15", "2026-11-16"],
    ["clamped month end on a Sunday (2027-02-28) moves to Monday", "2027-01-31", "2027-03-01"],
    ["public holiday (Christmas, a Friday) does not move it", "2026-11-25", "2026-12-25"],
  ])("%s: sent %s is due %s", (_, sent, due) => {
    expect(dueDate(sent)).toBe(due);
  });
});

describe("overdue", () => {
  const ledger: Ledger = {
    entries: [
      { broker: "due-today", state: "sent", dates: { sent: "2026-10-12", due: "2026-11-12" } },
      { broker: "day-after", state: "sent", dates: { sent: "2026-10-11", due: "2026-11-11" } },
      { broker: "long-ago", state: "sent", dates: { sent: "2026-08-01", due: "2026-09-01" } },
      { broker: "answered", state: "acknowledged", dates: { sent: "2026-09-01", due: "2026-10-01", replied: "2026-10-05" } },
      { broker: "drafted", state: "drafted", dates: { drafted: "2026-08-01" } },
    ],
  };

  it("is not overdue on the due date, is from the day after, and counts the days", () => {
    expect(overdue(ledger, "2026-11-12").map(({ entry, days }) => [entry.broker, days])).toEqual([
      ["day-after", 1],
      ["long-ago", 72],
    ]);
  });

  it("counts days across a year boundary", () => {
    const entry = { broker: "b", state: "sent" as const, dates: { sent: "2026-11-30", due: "2026-12-30" } };
    expect(overdue({ entries: [entry] }, "2027-01-02")).toEqual([{ entry, days: 3 }]);
  });

  it("never lists an acknowledged or drafted request", () => {
    const brokers = overdue(ledger, "2027-12-01").map(({ entry }) => entry.broker);
    expect(brokers).not.toContain("answered");
    expect(brokers).not.toContain("drafted");
  });

  it("returns nothing for an empty ledger", () => {
    expect(overdue({ entries: [] }, "2026-10-12")).toEqual([]);
  });
});
