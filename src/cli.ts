// The privacy-guard command line: `due`, `report`, `draft`, `send`, `reply`.
import {
  DEFAULT_LEDGER_PATH,
  type LedgerEntry,
  dueOn,
  isCalendarDate,
  loadLedger,
  openRequest,
  overdueOn,
  saveLedger,
  sentWithoutDueDate,
  stateDate,
} from "./ledger.ts";
import { DEFAULT_BROKERS_DIR, loadPlaybooks } from "./playbook.ts";
import { formatSubmission, renderFields } from "./render.ts";
import { guardedSend } from "./send.ts";
import { DEFAULT_SUBJECT_PATH, loadSubject } from "./subject.ts";

export interface CliEnv {
  ledgerPath: string;
  /** The directory of playbooks, brokers/<name>.yaml. */
  brokersDir: string;
  subjectPath: string;
  /** ISO calendar date, YYYY-MM-DD. */
  today: string;
  print: (line: string) => void;
}

const USAGE = "usage: privacy-guard <due | report | draft <broker> [--show] | send [--confirm] | reply <broker> [YYYY-MM-DD]>";

/** Runs one command and returns the process exit code. */
export async function main(argv: string[], env: CliEnv = defaultEnv()): Promise<number> {
  const [command, ...flags] = argv;
  switch (command) {
    case "due":
      return due(env);
    case "report":
      return report(env);
    case "draft": {
      const [broker] = flags.filter((arg) => !arg.startsWith("--"));
      if (broker === undefined) break;
      return draft(broker, flags.includes("--show"), env);
    }
    case "send":
      return send(flags.includes("--confirm"), env);
    case "reply": {
      const [broker, date] = flags;
      // reply takes no flags; a flag where the date goes is a mistyped command, not a bad date.
      if (broker === undefined || flags.length > 2 || flags.some((arg) => arg.startsWith("--"))) break;
      return reply(broker, date ?? env.today, env);
    }
  }
  env.print(USAGE);
  return 2;
}

function due(env: CliEnv): number {
  const entries = dueOn(loadLedger(env.ledgerPath), env.today);
  if (entries.length === 0) {
    env.print("nothing is due");
    return 0;
  }
  for (const entry of entries) env.print(`${entry.broker}: ${entry.state}, due ${entry.dates.due}`);
  return 0;
}

// Exits 1 when anything needs the human, so a scheduled job notices.
function report(env: CliEnv): number {
  const ledger = loadLedger(env.ledgerPath);
  // A hand-written ledger may lack the sent date; `loadLedger` does not require it.
  const sent = (entry: LedgerEntry) => `sent ${entry.dates.sent ?? "(date not recorded)"}`;
  const lines = [
    ...overdueOn(ledger, env.today).map(
      ({ entry, daysOverdue }) =>
        `${entry.broker}: ${sent(entry)}, due ${entry.dates.due}, ${daysOverdue} ${daysOverdue === 1 ? "day" : "days"} overdue`,
    ),
    // Passing a request that cannot be judged silently would be a false green.
    ...sentWithoutDueDate(ledger).map((entry) => `${entry.broker}: ${sent(entry)}, no due date recorded`),
  ];
  if (lines.length === 0) {
    env.print("nothing is overdue");
    return 0;
  }
  for (const line of lines) env.print(line);
  return 1;
}

// Refuses before writing anything; the ledger gets broker and date only, never a rendered value.
function draft(broker: string, show: boolean, env: CliEnv): number {
  const playbook = loadPlaybooks(env.brokersDir).find((candidate) => candidate.name === broker);
  if (playbook === undefined) {
    env.print(`no playbook for ${broker} in ${env.brokersDir}`);
    return 1;
  }
  const ledger = loadLedger(env.ledgerPath);
  const open = openRequest(ledger, broker);
  if (open !== undefined) {
    env.print(`${broker} already has an open request: ${stateAndDate(open.entry)}`);
    return 1;
  }
  let fields;
  try {
    fields = renderFields(playbook.form.fields, loadSubject(env.subjectPath));
  } catch (error) {
    env.print((error as Error).message);
    return 1;
  }
  ledger.entries.push({ broker, state: "drafted", dates: { drafted: env.today } });
  saveLedger(env.ledgerPath, ledger);

  for (const line of formatSubmission(playbook.form, fields, show)) env.print(line);
  if (!show) env.print(`Subject values are hidden. To see them: privacy-guard send ${broker} --show`);
  env.print("");
  env.print(`drafted a request to ${broker}. Review it, then: privacy-guard send ${broker} --confirm`);
  return 0;
}

// The human records the broker's reply by hand; privacy-guard does not read the inbox.
function reply(broker: string, date: string, env: CliEnv): number {
  const ledger = loadLedger(env.ledgerPath);
  const open = openRequest(ledger, broker);
  if (open === undefined || (open.entry.state !== "sent" && open.entry.state !== "escalated")) {
    // With no open request, name the broker's latest (acknowledged) entry, if any.
    const latest = open?.entry ?? ledger.entries.filter((entry) => entry.broker === broker).at(-1);
    env.print(`${broker} has no sent or escalated request: found ${latest === undefined ? "no request" : stateAndDate(latest)}`);
    return 1;
  }
  const { entry } = open;
  const refusal = dateRefusal(date, entry.dates.sent, env.today);
  if (refusal !== undefined) {
    env.print(refusal);
    return 1;
  }
  entry.state = "acknowledged";
  entry.dates.acknowledged = date;
  saveLedger(env.ledgerPath, ledger);
  env.print(`recorded ${broker} as acknowledged ${date}`);
  return 0;
}

// "<state> <date>", the date the entry reached its state; the state alone when that date is not recorded.
function stateAndDate(entry: LedgerEntry): string {
  const date = stateDate(entry);
  return `${entry.state}${date === undefined ? "" : ` ${date}`}`;
}

// Why a date the human gives for something that happened is refused: not a real day, in the future, or before
// the send. Undefined when it is accepted.
function dateRefusal(date: string, sent: string | undefined, today: string): string | undefined {
  if (!isCalendarDate(date)) return `date "${date}" is not a YYYY-MM-DD date`;
  if (date > today) return `date ${date} lies after today, ${today}`;
  if (sent !== undefined && date < sent) return `date ${date} lies before the sent date, ${sent}`;
  return undefined;
}

// Every send goes through the guard; no channel can deliver yet, so a confirmed send fails.
async function send(confirm: boolean, env: CliEnv): Promise<number> {
  if (!confirm) env.print("dry run: nothing was sent. A real send needs --confirm.");
  const drafted = loadLedger(env.ledgerPath).entries.filter((entry) => entry.state === "drafted");
  if (drafted.length === 0) env.print("no drafted requests to send.");
  for (const entry of drafted) {
    try {
      const result = await guardedSend({ broker: entry.broker }, { confirm, deliver: noChannel });
      if (!result.sent) env.print(`would send to ${entry.broker}`);
    } catch (error) {
      env.print(`${(error as Error).message}, so nothing was sent to ${entry.broker}.`);
      return 1;
    }
  }
  return 0;
}

function noChannel(): never {
  throw new Error("send is not implemented yet: no channel can send");
}

function defaultEnv(): CliEnv {
  return {
    ledgerPath: DEFAULT_LEDGER_PATH,
    brokersDir: DEFAULT_BROKERS_DIR,
    subjectPath: DEFAULT_SUBJECT_PATH,
    today: localDate(new Date()),
    print: (line) => console.log(line),
  };
}

function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
