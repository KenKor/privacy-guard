import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type Ledger,
  type LedgerEntry,
  dueDate,
  dueOn,
  loadLedger,
  overdueOn,
  recordSubmitted,
  saveLedger,
  sentWithoutDueDate,
} from "../src/ledger.ts";

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

  it("rejects a stored overdue state: overdue is derived, never stored", () => {
    const path = tmpLedger();
    saveLedger(path, { entries: [{ broker: "broker-a", state: "overdue" as never, dates: {} }] });
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

  it("round-trips a receipt reference and a submission date", () => {
    const path = tmpLedger();
    const ledger: Ledger = {
      entries: [
        { broker: "broker-a", state: "sent", reference: "BA-482915", dates: { submitted: "2026-10-12", sent: "2026-10-12", due: "2026-11-12" } },
      ],
    };
    saveLedger(path, ledger);
    expect(loadLedger(path)).toEqual(ledger);
  });

  it("rejects a reference that is not a string", () => {
    const path = tmpLedger();
    writeFileSync(path, JSON.stringify({ entries: [{ broker: "broker-a", state: "sent", reference: 482915, dates: {} }] }));
    expect(() => loadLedger(path)).toThrow(`${path}: entry 0: reference must be a string`);
  });

  it("rejects a submission date that is not YYYY-MM-DD", () => {
    const path = tmpLedger();
    writeFileSync(path, JSON.stringify({ entries: [{ broker: "broker-a", state: "drafted", dates: { submitted: "today" } }] }));
    expect(() => loadLedger(path)).toThrow(`${path}: entry 0: dates.submitted "today" is not a YYYY-MM-DD date`);
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
      // Changed under docs/prds/completed/opt-out-broker-a.md, plan item 2 (overdue is derived, not stored).
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

describe("recordSubmitted", () => {
  const drafted = (submitted?: string): LedgerEntry => ({
    broker: "broker-a",
    state: "drafted",
    dates: submitted === undefined ? { drafted: "2026-10-01" } : { drafted: "2026-10-01", submitted },
  });
  const submittedAfter = (entry: LedgerEntry) => {
    recordSubmitted(entry, "2026-10-12");
    return entry.dates.submitted;
  };

  it("sets today on a first attempt and keeps an earlier attempt's date", () => {
    expect(submittedAfter(drafted())).toBe("2026-10-12");
    expect(submittedAfter(drafted("2026-10-05"))).toBe("2026-10-05");
  });

  it("replaces a date after today, which cannot be an earlier attempt", () => {
    expect(submittedAfter(drafted("2026-12-01"))).toBe("2026-10-12");
  });
});

describe("overdueOn", () => {
  const sentToBrokerA = { broker: "broker-a", state: "sent", dates: { sent: "2026-10-12", due: "2026-11-12" } } as const;
  const brokers = (ledger: Ledger, today: string) => overdueOn(ledger, today).map(({ entry }) => entry.broker);

  it("is not overdue on the due date itself", () => {
    expect(overdueOn({ entries: [sentToBrokerA] }, "2026-11-12")).toEqual([]);
  });

  it("is overdue the day after the due date, by 1 day", () => {
    expect(overdueOn({ entries: [sentToBrokerA] }, "2026-11-13")).toEqual([{ entry: sentToBrokerA, daysOverdue: 1 }]);
  });

  it("counts calendar days across month and year ends", () => {
    expect(overdueOn({ entries: [sentToBrokerA] }, "2026-12-13")[0].daysOverdue).toBe(31);
    expect(overdueOn({ entries: [sentToBrokerA] }, "2027-01-01")[0].daysOverdue).toBe(50);
    const february = { ...sentToBrokerA, dates: { sent: "2028-01-31", due: "2028-02-29" } };
    expect(overdueOn({ entries: [february] }, "2028-03-01")[0].daysOverdue).toBe(1);
  });

  it("only judges sent requests that have a due date", () => {
    const ledger: Ledger = {
      entries: [
        sentToBrokerA,
        { broker: "answered", state: "acknowledged", dates: { sent: "2026-09-01", acknowledged: "2026-09-20", due: "2026-10-01" } },
        { broker: "drafted", state: "drafted", dates: { drafted: "2026-09-01", due: "2026-10-01" } },
        { broker: "escalated", state: "escalated", dates: { sent: "2026-09-01", due: "2026-10-01" } },
        { broker: "no-due", state: "sent", dates: { sent: "2026-09-01" } },
      ],
    };
    expect(brokers(ledger, "2026-11-13")).toEqual(["broker-a"]);
  });
});

describe("sentWithoutDueDate", () => {
  it("returns sent requests that cannot be judged overdue because no due date is recorded", () => {
    const ledger: Ledger = {
      entries: [
        { broker: "no-due", state: "sent", dates: { sent: "2026-09-01" } },
        { broker: "with-due", state: "sent", dates: { sent: "2026-09-01", due: "2026-10-01" } },
        { broker: "drafted", state: "drafted", dates: { drafted: "2026-09-01" } },
      ],
    };
    expect(sentWithoutDueDate(ledger).map((e) => e.broker)).toEqual(["no-due"]);
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
    // Changed under docs/prds/completed/opt-out-broker-a.md, plan item 11 (0100-01-31 is a Sunday, so 0100-02-01).
    expect(dueDate("0099-12-31")).toBe("0100-02-01");
    expect(dueDate("0099-11-30")).toBe("0099-12-30");
  });

  // Never later than the law allows, so no rolling over into the month after.
  it.each([
    ["2028-01-31", "2028-02-29"],
    ["2000-01-31", "2000-02-29"],
    ["2026-03-31", "2026-04-30"],
    ["2026-08-31", "2026-09-30"],
  ])("is the last day of the target month when it has no such day: %s -> %s", (sent, due) => {
    expect(dueDate(sent)).toBe(due);
  });

  // Changed under docs/prds/completed/opt-out-broker-a.md, plan item 11 (weekend due dates move to Monday):
  // these rows were 2026-02-28 (a Saturday) and 2100-02-28 (a Sunday) under the last-day test above.
  it.each([
    ["2026-01-31", "2026-03-02"],
    ["2100-01-31", "2100-03-01"],
  ])("is the following Monday when the target month's last day falls on a weekend: %s -> %s", (sent, due) => {
    expect(dueDate(sent)).toBe(due);
  });

  // Added under docs/prds/completed/opt-out-broker-a.md, plan item 11 (the 2026-02-14 row; 14 March is a Saturday).
  it("moves a Saturday due date to the following Monday: 2026-02-14 -> 2026-03-16", () => {
    expect(dueDate("2026-02-14")).toBe("2026-03-16");
  });

  it.each(["12/10/2026", "2026-13-05", "2026-00-10", "2026-02-30", "2026-04-31", "2026-10-00"])(
    "rejects a sent date that is not a YYYY-MM-DD calendar date: %s",
    (sent) => {
      expect(() => dueDate(sent)).toThrow(`sent date "${sent}" is not a YYYY-MM-DD date`);
    },
  );
});
