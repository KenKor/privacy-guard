// The request ledger: one entry per request to a broker, kept in a local, git-ignored JSON file.
// It holds only what tracking a request needs (broker, state, dates, the receipt reference), no
// personal data. Overdue is not stored: it is worked out from the dates whenever the ledger is read.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const DEFAULT_LEDGER_PATH = "ledger.json";

export const STATES = ["drafted", "sent", "acknowledged"] as const;
export type State = (typeof STATES)[number];

const DATE_NAMES = ["drafted", "sent", "due", "replied"] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Dates are ISO calendar dates, YYYY-MM-DD. */
export interface LedgerEntry {
  broker: string;
  state: State;
  /** The reference from the broker's receipt; set once the request is sent. */
  reference?: string;
  dates: { drafted?: string; sent?: string; due?: string; replied?: string };
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
      throw new Error(`${path}: entry ${i} (${entry?.broker}): ${message}`);
    };
    if (!STATES.includes(entry.state)) fail(`state "${entry.state}" is not one of ${STATES.join(", ")}`);
    if (entry.reference !== undefined && typeof entry.reference !== "string") fail("reference must be a string");
    if (typeof entry.dates !== "object" || entry.dates === null || Array.isArray(entry.dates)) {
      fail(`expected a "dates" object`);
    }
    for (const [name, date] of Object.entries(entry.dates)) {
      if (!(DATE_NAMES as readonly string[]).includes(name)) fail(`dates.${name} is not a ledger date`);
      if (typeof date !== "string" || !ISO_DATE.test(date)) fail(`dates.${name} "${date}" is not a YYYY-MM-DD date`);
    }
  }
  return ledger;
}

export function saveLedger(path: string, ledger: Ledger): void {
  writeFileSync(path, JSON.stringify(ledger, null, 2) + "\n");
}

/** The broker's first request in one of `states`. */
export function findRequest(ledger: Ledger, broker: string, states: readonly State[]): LedgerEntry | undefined {
  return ledger.entries.find((entry) => entry.broker === broker && states.includes(entry.state));
}

/** A receipt came back on `today`: the request is sent and its clock starts. */
export function markSent(entry: LedgerEntry, reference: string, today: string): void {
  entry.state = "sent";
  entry.reference = reference;
  entry.dates.sent = today;
  entry.dates.due = dueDate(today);
}

/** The broker replied on `date`: the request is acknowledged and its clock stops. */
export function recordReply(entry: LedgerEntry, date: string): void {
  entry.state = "acknowledged";
  entry.dates.replied = date;
}

/**
 * The due date for a request sent on `sent`: the same day one calendar month later, or that
 * month's last day when it has no such day (GDPR Article 12(3)). Weekends and holidays do not move
 * it. Works on the date's parts, so no time zone can shift the day.
 */
export function dueDate(sent: string): string {
  const [year, month, day] = sent.split("-").map(Number);
  const [dueYear, dueMonth] = month === 12 ? [year + 1, 1] : [year, month + 1];
  const lastDay = daysInMonth(dueYear, dueMonth);
  return isoDate(dueYear, dueMonth, Math.min(day, lastDay));
}

/** Sent requests whose due date has passed, with the days since: overdue from the day after the due date. */
export function overdue(ledger: Ledger, today: string): { entry: LedgerEntry; days: number }[] {
  return ledger.entries
    .filter((entry) => entry.state === "sent" && entry.dates.due !== undefined && today > entry.dates.due)
    .map((entry) => ({ entry, days: daysBetween(entry.dates.due!, today) }));
}

/** Whole days from `from` to `to`, both YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  return (utcDay(to) - utcDay(from)) / 86_400_000;
}

function utcDay(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoDate(year: number, month: number, day: number): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}
