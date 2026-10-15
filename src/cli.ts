// The privacy-guard command line: `due`, `report`, `draft`, `send`.
import { DEFAULT_LEDGER_PATH, daysOverdue, dueOn, isOverdue, loadLedger } from "./ledger.ts";
import { guardedSend } from "./send.ts";

export interface CliEnv {
  ledgerPath: string;
  /** ISO calendar date, YYYY-MM-DD. */
  today: string;
  print: (line: string) => void;
}

const USAGE = "usage: privacy-guard <due | report | draft | send [--confirm]>";

/** Runs one command and returns the process exit code. */
export async function main(argv: string[], env: CliEnv = defaultEnv()): Promise<number> {
  const [command, ...flags] = argv;
  switch (command) {
    case "due":
      return due(env);
    case "report":
      return report(env);
    case "draft":
      env.print("draft is not implemented yet");
      return 0;
    case "send":
      return send(flags.includes("--confirm"), env);
    default:
      env.print(USAGE);
      return 2;
  }
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

// Lists overdue requests and sent requests with no due date, in ledger order; exits 1 if it listed any,
// so a scheduled job notices.
function report(env: CliEnv): number {
  let flagged = 0;
  for (const entry of loadLedger(env.ledgerPath).entries) {
    const dueDate = entry.dates.due;
    const sentPhrase = entry.dates.sent === undefined ? "sent" : `sent ${entry.dates.sent}`;
    if (entry.state === "sent" && dueDate === undefined) {
      env.print(`${entry.broker}: ${sentPhrase}, no due date recorded`);
    } else if (isOverdue(entry, env.today)) {
      const days = daysOverdue(dueDate as string, env.today);
      env.print(`${entry.broker}: ${sentPhrase}, due ${dueDate}, ${days} ${days === 1 ? "day" : "days"} overdue`);
    } else {
      continue;
    }
    flagged++;
  }
  if (flagged > 0) return 1;
  env.print("nothing is overdue");
  return 0;
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
    today: localDate(new Date()),
    print: (line) => console.log(line),
  };
}

function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
