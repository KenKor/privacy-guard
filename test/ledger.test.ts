import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type Ledger, dueDate, dueOn, loadLedger, saveLedger } from "../src/ledger.ts";

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
      { broker: "past-due", state: "overdue", dates: { sent: "2026-08-01", due: "2026-09-01" } },
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

describe("dueDate", () => {
  it("is the same day one calendar month after the sent date", () => {
    expect(dueDate("2026-10-12")).toBe("2026-11-12");
  });

  it("crosses into the next year from December", () => {
    expect(dueDate("2026-12-15")).toBe("2027-01-15");
  });

  it("keeps the year four digits", () => {
    expect(dueDate("0099-12-31")).toBe("0100-01-31");
    expect(dueDate("0099-11-30")).toBe("0099-12-30");
  });

  // Never later than the law allows, so no rolling over into the month after.
  it.each([
    ["2026-01-31", "2026-02-28"],
    ["2028-01-31", "2028-02-29"],
    ["2100-01-31", "2100-02-28"],
    ["2000-01-31", "2000-02-29"],
    ["2026-03-31", "2026-04-30"],
    ["2026-08-31", "2026-09-30"],
  ])("is the last day of the target month when it has no such day: %s -> %s", (sent, due) => {
    expect(dueDate(sent)).toBe(due);
  });

  it.each(["12/10/2026", "2026-13-05", "2026-00-10", "2026-02-30", "2026-04-31", "2026-10-00"])(
    "rejects a sent date that is not a YYYY-MM-DD calendar date: %s",
    (sent) => {
      expect(() => dueDate(sent)).toThrow(`sent date "${sent}" is not a YYYY-MM-DD date`);
    },
  );
});
