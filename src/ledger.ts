// The request ledger: one entry per request to a broker, kept in a local, git-ignored JSON file.
// It holds only what tracking a request needs (broker, state, dates, the broker's receipt reference),
// no personal data.
// A request's due date is one calendar month from sending, moved off a weekend (`dueDate`); whoever records the send stores it.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const DEFAULT_LEDGER_PATH = "ledger.json";

// Overdue is not a state: it is derived on every read (`overdueOn`), never stored.
export const STATES = ["drafted", "sent", "acknowledged", "escalated"] as const;
export type State = (typeof STATES)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Dates are ISO calendar dates, YYYY-MM-DD. */
export interface LedgerEntry {
  broker: string;
  state: State;
  /** The broker's receipt reference, such as "BA-482915". Not personal data. */
  reference?: string;
  /**
   * `submitted` is the first confirmed submission that got no receipt: the request may or may not
   * have reached the broker, so a `drafted` entry with it stays in `report` until resolved.
   */
  dates: { drafted?: string; submitted?: string; sent?: string; acknowledged?: string; escalated?: string; due?: string };
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
    if (entry.reference !== undefined && typeof entry.reference !== "string") fail("reference must be a string");
    for (const [name, date] of Object.entries(entry.dates)) {
      if (typeof date !== "string" || !ISO_DATE.test(date)) fail(`dates.${name} "${date}" is not a YYYY-MM-DD date`);
    }
  }
  return ledger;
}

export function saveLedger(path: string, ledger: Ledger): void {
  writeFileSync(path, JSON.stringify(ledger, null, 2) + "\n");
}

/**
 * The due date of a request sent on `sent` (YYYY-MM-DD): one calendar month later, or the last day of
 * that month when it has no such day (never later than the law allows). Calendar months, not 30 days.
 */
export function dueDate(sent: string): string {
  if (!isCalendarDate(sent)) throw new Error(`sent date "${sent}" is not a YYYY-MM-DD date`);
  const [year, month, day] = sent.split("-").map(Number);
  const dueYear = month === 12 ? year + 1 : year;
  const dueMonth = month === 12 ? 1 : month + 1;
  const dueDay = Math.min(day, daysInMonth(dueYear, dueMonth));
  // D-17: a due date on a Saturday or Sunday moves to the following Monday.
  const due = new Date(Date.UTC(dueYear, dueMonth - 1, dueDay));
  due.setUTCFullYear(dueYear);
  const weekday = due.getUTCDay();
  if (weekday === 6) due.setUTCDate(due.getUTCDate() + 2);
  if (weekday === 0) due.setUTCDate(due.getUTCDate() + 1);
  return `${String(due.getUTCFullYear()).padStart(4, "0")}-${String(due.getUTCMonth() + 1).padStart(2, "0")}-${String(due.getUTCDate()).padStart(2, "0")}`;
}

/** Whether `date` is YYYY-MM-DD and a day the calendar has (not 2026-02-30). */
export function isCalendarDate(date: string): boolean {
  const [year, month, day] = date.split("-").map(Number);
  return ISO_DATE.test(date) && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** The broker's open request (any state but `acknowledged`) and the date it reached that state, if any. */
export function openRequest(ledger: Ledger, broker: string): { entry: LedgerEntry; date?: string } | undefined {
  const entry = ledger.entries.find((candidate) => candidate.broker === broker && candidate.state !== "acknowledged");
  if (entry === undefined) return undefined;
  return { entry, date: stateDate(entry) };
}

/** The date the entry reached its current state, if recorded. */
export function stateDate(entry: LedgerEntry): string | undefined {
  return (entry.dates as Record<string, string | undefined>)[entry.state];
}

/** Entries still waiting on the broker whose due date is `today` or earlier. */
export function dueOn(ledger: Ledger, today: string): LedgerEntry[] {
  return ledger.entries.filter(
    (entry) => entry.state !== "acknowledged" && entry.dates.due !== undefined && entry.dates.due <= today,
  );
}

export interface Overdue {
  entry: LedgerEntry;
  /** Calendar days from the due date to today; 1 on the day after the due date. */
  daysOverdue: number;
}

/**
 * Requests overdue on `today`: stored state `sent`, a due date, and `today` strictly after it.
 * Derived on every read, never stored. A `sent` entry without a due date cannot be judged; see `sentWithoutDueDate`.
 */
export function overdueOn(ledger: Ledger, today: string): Overdue[] {
  return ledger.entries.flatMap((entry) =>
    isOverdue(entry, today) ? [{ entry, daysOverdue: daysBetween(entry.dates.due, today) }] : [],
  );
}

/** Whether the entry is overdue on `today`: stored state `sent`, a due date, and `today` strictly after it. */
export function isOverdue(entry: LedgerEntry, today: string): entry is LedgerEntry & { dates: { due: string } } {
  return entry.state === "sent" && entry.dates.due !== undefined && today > entry.dates.due;
}

/** `sent` requests with no due date recorded: neither overdue nor not, so `report` warns about them. */
export function sentWithoutDueDate(ledger: Ledger): LedgerEntry[] {
  return ledger.entries.filter((entry) => entry.state === "sent" && entry.dates.due === undefined);
}

/** `escalated` requests: taken to the supervisory authority, still without the broker's reply. */
export function escalatedWithoutReply(ledger: Ledger): LedgerEntry[] {
  return ledger.entries.filter((entry) => entry.state === "escalated");
}

/**
 * Marks a request sent on a receipt. The sent date is the first submission's when there was one, as it
 * may be the one that arrived (D-16), else `today`; the due date follows from it. The reference is
 * optional only on the human's word that it arrived without one (D-15).
 */
export function recordSent(entry: LedgerEntry, reference: string | undefined, today: string): void {
  const sent = entry.dates.submitted ?? today;
  entry.state = "sent";
  if (reference !== undefined) entry.reference = reference;
  entry.dates.sent = sent;
  entry.dates.due = dueDate(sent);
}

/**
 * Records a confirmed submission that got no receipt; the request stays `drafted`. The first attempt's
 * date stays, so a later receipt never dates the request later than the law allows. A date after
 * `today` (a hand edit or a wrong clock) is not an earlier attempt, so `today` replaces it.
 */
export function recordSubmitted(entry: LedgerEntry, today: string): void {
  const submitted = entry.dates.submitted;
  if (submitted === undefined || submitted > today) entry.dates.submitted = today;
}

/** `drafted` requests whose confirmed submission got no receipt: they may have reached the broker. */
export function submittedWithoutReceipt(ledger: Ledger): LedgerEntry[] {
  return ledger.entries.filter((entry) => entry.state === "drafted" && entry.dates.submitted !== undefined);
}

// UTC midnights, so no daylight-saving shift can make a day 23 or 25 hours long.
function daysBetween(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
}
