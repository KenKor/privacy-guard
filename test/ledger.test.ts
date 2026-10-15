import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type Ledger, type LedgerEntry, daysOverdue, dueOn, isOverdue, loadLedger, saveLedger } from "../src/ledger.ts";

const tmpLedger = () => join(mkdtempSync(join(tmpdir(), "ledger-")), "ledger.json");

describe("ledger", () => {
  it("is empty when the file does not exist yet", () => {
    expect(loadLedger(tmpLedger())).toEqual({ entries: [] });
  });

  it("round-trips through the file", () => {
    const path = tmpLedger();
    const ledger: Ledger = {
      entries: [{ broker: "broker-a", state: "sent", dates: { drafted: "2026-10-01", sent: "2026-10-02", due: "2026-11-02" } }],
    };
    saveLedger(path, ledger);
    expect(loadLedger(path)).toEqual(ledger);
  });

  it("rejects an entry with an unknown state", () => {
    const path = tmpLedger();
    saveLedger(path, { entries: [{ broker: "broker-a", state: "lost" as never, dates: {} }] });
    expect(() => loadLedger(path)).toThrow(/state "lost" is not one of/);
  });

  it("rejects a stored overdue state", () => {
    const path = tmpLedger();
    writeFileSync(path, JSON.stringify({ entries: [{ broker: "broker-a", state: "overdue", dates: {} }] }));
    expect(() => loadLedger(path)).toThrow(
      `${path}: entry 0: state "overdue" is not one of drafted, sent, acknowledged, escalated`,
    );
  });

  it("rejects an entry without dates, naming the file and the entry", () => {
    const path = tmpLedger();
    writeFileSync(path, JSON.stringify({ entries: [{ broker: "broker-a", state: "sent" }] }));
    expect(() => loadLedger(path)).toThrow(`${path}: entry 0: expected a "dates" object`);
  });

  it("rejects a date that is not YYYY-MM-DD", () => {
    const path = tmpLedger();
    writeFileSync(path, JSON.stringify({ entries: [{ broker: "broker-a", state: "sent", dates: { due: "12/10/2026" } }] }));
    expect(() => loadLedger(path)).toThrow(`${path}: entry 0: dates.due "12/10/2026" is not a YYYY-MM-DD date`);
  });

  it("names the file when it is not valid JSON", () => {
    const path = tmpLedger();
    writeFileSync(path, "{ entries: ");
    expect(() => loadLedger(path)).toThrow(`${path}: not valid JSON`);
  });
});

describe("dueOn", () => {
  const ledger: Ledger = {
    entries: [
      { broker: "due-today", state: "sent", dates: { sent: "2026-09-12", due: "2026-10-12" } },
      { broker: "past-due", state: "sent", dates: { sent: "2026-08-01", due: "2026-09-01" } },
      { broker: "due-later", state: "sent", dates: { sent: "2026-10-01", due: "2026-11-01" } },
      { broker: "answered", state: "acknowledged", dates: { sent: "2026-09-01", due: "2026-10-01" } },
      { broker: "no-date", state: "drafted", dates: { drafted: "2026-10-12" } },
    ],
  };

  it("returns open entries due on or before today", () => {
    expect(dueOn(ledger, "2026-10-12").map((e) => e.broker)).toEqual(["due-today", "past-due"]);
  });

  it("returns nothing for an empty ledger", () => {
    expect(dueOn({ entries: [] }, "2026-10-12")).toEqual([]);
  });
});

describe("isOverdue", () => {
  const sent: LedgerEntry = { broker: "broker-a", state: "sent", dates: { sent: "2026-10-12", due: "2026-11-12" } };

  it("is not overdue on its due date, and is the day after", () => {
    expect(isOverdue(sent, "2026-11-12")).toBe(false);
    expect(isOverdue(sent, "2026-11-13")).toBe(true);
  });

  it("never counts a drafted, acknowledged or escalated entry", () => {
    for (const state of ["drafted", "acknowledged", "escalated"] as const) {
      expect(isOverdue({ ...sent, state }, "2026-12-01")).toBe(false);
    }
  });

  it("does not count a sent entry without a due date", () => {
    expect(isOverdue({ broker: "broker-x", state: "sent", dates: { sent: "2026-09-01" } }, "2026-12-01")).toBe(false);
  });
});

describe("daysOverdue", () => {
  it("counts calendar days from the due date", () => {
    expect(daysOverdue("2026-11-12", "2026-11-13")).toBe(1);
    expect(daysOverdue("2026-10-30", "2026-11-02")).toBe(3);
    // Daylight saving ends in the EU on 2026-10-25; the count stays whole.
    expect(daysOverdue("2026-10-24", "2026-10-26")).toBe(2);
  });
});
