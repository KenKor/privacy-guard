// The request ledger: one entry per request to a broker, kept in a local, git-ignored JSON file.
// It holds only what tracking a request needs (broker, state, dates), no personal data.
// Computing the due date (one calendar month from sending) is not here yet; whoever records an entry sets it.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const DEFAULT_LEDGER_PATH = "ledger.json";

// Overdue is not a state: it is worked out from a sent request's due date on every read (isOverdue).
export const STATES = ["drafted", "sent", "acknowledged", "escalated"] as const;
export type State = (typeof STATES)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Dates are ISO calendar dates, YYYY-MM-DD. */
export interface LedgerEntry {
  broker: string;
  state: State;
  dates: { drafted?: string; sent?: string; acknowledged?: string; due?: string };
}

export interface Ledger {
  entries: LedgerEntry[];
}

/** Loads the ledger; a ledger file that does not exist yet is an empty ledger. */
export function loadLedger(path: string = DEFAULT_LEDGER_PATH): Ledger {
  if (!existsSync(path)) return { entries: [] };
  let ledger: Ledger;
  try {
    ledger = JSON.parse(readFileSync(path, "utf8")) as Ledger;
  } catch (error) {
    throw new Error(`${path}: not valid JSON (${(error as Error).message})`);
  }
  if (!Array.isArray(ledger?.entries)) throw new Error(`${path}: expected an "entries" array`);
  for (const [i, entry] of ledger.entries.entries()) {
    const fail = (message: string): never => {
      throw new Error(`${path}: entry ${i}: ${message}`);
    };
    if (!STATES.includes(entry.state)) fail(`state "${entry.state}" is not one of ${STATES.join(", ")}`);
    if (typeof entry.dates !== "object" || entry.dates === null || Array.isArray(entry.dates)) {
      fail(`expected a "dates" object`);
    }
    for (const [name, date] of Object.entries(entry.dates)) {
      if (typeof date !== "string" || !ISO_DATE.test(date)) fail(`dates.${name} "${date}" is not a YYYY-MM-DD date`);
    }
  }
  return ledger;
}

export function saveLedger(path: string, ledger: Ledger): void {
  writeFileSync(path, JSON.stringify(ledger, null, 2) + "\n");
}

/** Entries still waiting on the broker whose due date is `today` or earlier. */
export function dueOn(ledger: Ledger, today: string): LedgerEntry[] {
  return ledger.entries.filter(
    (entry) => entry.state !== "acknowledged" && entry.dates.due !== undefined && entry.dates.due <= today,
  );
}

/** A sent request is overdue from the day after its due date; on the due date itself it is not. */
export function isOverdue(entry: LedgerEntry, today: string): boolean {
  return entry.state === "sent" && entry.dates.due !== undefined && entry.dates.due < today;
}

/** Calendar days from `due` to `today` (2026-11-12 to 2026-11-13: 1). UTC, so no daylight-saving drift. */
export function daysOverdue(due: string, today: string): number {
  const utc = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return (utc(today) - utc(due)) / 86_400_000;
}
