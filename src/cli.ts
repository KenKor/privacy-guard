// The privacy-guard command line: `draft`, `send`, `reply`, `report`.
import {
  DEFAULT_LEDGER_PATH,
  findRequest,
  loadLedger,
  markSent,
  overdue,
  recordReply,
  saveLedger,
} from "./ledger.ts";
import { loadPlaybooks, type Playbook } from "./playbook.ts";
import { describeSubmission, renderFields } from "./render.ts";
import { type Deliver, guardedSend } from "./send.ts";
import { DEFAULT_SUBJECT_PATH, loadSubject } from "./subject.ts";
import { submitWebForm } from "./web-form.ts";

export interface CliEnv {
  ledgerPath: string;
  brokersDir: string;
  subjectPath: string;
  /** ISO calendar date, YYYY-MM-DD. */
  today: string;
  print: (line: string) => void;
  deliver: Deliver;
}

const USAGE =
  "usage: privacy-guard <draft <broker> [--show] | send <broker> [--confirm] [--show] | reply <broker> [YYYY-MM-DD] | report>";

class UsageError extends Error {}

/** Runs one command and returns the process exit code. */
export async function main(argv: string[], env: CliEnv = defaultEnv()): Promise<number> {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case "draft": {
        const { broker, flags } = parseArgs(rest, ["--show"], 0);
        return draft(broker, flags.has("--show"), env);
      }
      case "send": {
        const { broker, flags } = parseArgs(rest, ["--confirm", "--show"], 0);
        return await send(broker, flags.has("--confirm"), flags.has("--show"), env);
      }
      case "reply": {
        const { broker, extra } = parseArgs(rest, [], 1);
        return reply(broker, extra[0] ?? env.today, env);
      }
      case "report":
        parseArgs(rest, [], 0, false);
        return report(env);
      default:
        throw new UsageError();
    }
  } catch (error) {
    if (error instanceof UsageError) {
      env.print(USAGE);
      return 2;
    }
    env.print((error as Error).message);
    return 1;
  }
}

/** Splits `args` into the broker, the flags, and up to `maxExtra` further positional arguments. */
function parseArgs(args: string[], allowedFlags: string[], maxExtra: number, needsBroker = true) {
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const [broker, ...extra] = args.filter((arg) => !arg.startsWith("--"));
  if ([...flags].some((flag) => !allowedFlags.includes(flag))) throw new UsageError();
  if (needsBroker ? broker === undefined || extra.length > maxExtra : broker !== undefined) throw new UsageError();
  return { broker, flags, extra };
}

function draft(broker: string, show: boolean, env: CliEnv): number {
  const playbook = findPlaybook(broker, env);
  const ledger = loadLedger(env.ledgerPath);
  const open = findRequest(ledger, broker, ["drafted", "sent"]);
  if (open) {
    const since = open.state === "sent" ? open.dates.sent : open.dates.drafted;
    env.print(`${broker} has a ${open.state} request from ${since}; a broker has one open request at a time.`);
    return 1;
  }
  const fields = renderFields(playbook.form.fields, loadSubject(env.subjectPath));
  for (const line of describeSubmission(playbook, fields, show)) env.print(line);
  ledger.entries.push({ broker, state: "drafted", dates: { drafted: env.today } });
  saveLedger(env.ledgerPath, ledger);
  env.print(`drafted a request to ${broker}. Send it with: privacy-guard send ${broker} --confirm`);
  return 0;
}

// Only a receipt changes the ledger; every other outcome leaves the request drafted.
async function send(broker: string, confirm: boolean, show: boolean, env: CliEnv): Promise<number> {
  const playbook = findPlaybook(broker, env);
  const ledger = loadLedger(env.ledgerPath);
  const entry = findRequest(ledger, broker, ["drafted"]);
  if (!entry) {
    env.print(`${broker} has no drafted request, so nothing was sent. Draft one with: privacy-guard draft ${broker}`);
    return 1;
  }
  const fields = renderFields(playbook.form.fields, loadSubject(env.subjectPath));
  const result = await guardedSend({ playbook, fields }, { confirm, deliver: env.deliver });
  if (result.dryRun) {
    env.print("dry run: nothing was sent. A confirmed send needs --confirm. It would send:");
    for (const line of describeSubmission(playbook, fields, show)) env.print(line);
    return 0;
  }

  const { outcome } = result;
  switch (outcome.kind) {
    case "receipt":
      // The broker has the request now: print the reference first, so a failed save can't lose it.
      markSent(entry, outcome.reference, env.today);
      env.print(`sent to ${broker}: reference ${outcome.reference}, sent ${entry.dates.sent}, due ${entry.dates.due}`);
      try {
        saveLedger(env.ledgerPath, ledger);
      } catch (error) {
        env.print(
          `but ${env.ledgerPath} could not be saved (${(error as Error).message}), so the ledger still says drafted. ` +
            `Keep reference ${outcome.reference}: the request was sent on ${entry.dates.sent}, so do not send it again.`,
        );
        return 1;
      }
      return 0;
    case "not-sent":
      env.print(`not sent to ${broker}: ${outcome.reason}. The request is still drafted.`);
      return 1;
    case "unclear":
      env.print(
        `the request to ${broker} may have arrived without a receipt (${outcome.reason}). It is still drafted. ` +
          `Check ${playbook.display_name}'s mail before sending again.`,
      );
      return 1;
  }
}

function reply(broker: string, date: string, env: CliEnv): number {
  const ledger = loadLedger(env.ledgerPath);
  const entry = findRequest(ledger, broker, ["sent"]);
  if (!entry) {
    const isDrafted = findRequest(ledger, broker, ["drafted"]) !== undefined;
    env.print(isDrafted ? `${broker}'s request was not sent: it is still drafted.` : `${broker} has no sent request.`);
    return 1;
  }
  if (!isCalendarDate(date)) {
    env.print(`"${date}" is not a YYYY-MM-DD date.`);
    return 1;
  }
  if (date < entry.dates.sent!) {
    env.print(`${date} is before the request was sent, on ${entry.dates.sent}.`);
    return 1;
  }
  if (date > env.today) {
    env.print(`${date} is in the future.`);
    return 1;
  }
  recordReply(entry, date);
  saveLedger(env.ledgerPath, ledger);
  env.print(`${broker}: reply recorded on ${date}. The request is acknowledged.`);
  return 0;
}

function report(env: CliEnv): number {
  const ledger = loadLedger(env.ledgerPath);
  const overdueRequests = overdue(ledger, env.today);
  const drafted = ledger.entries.filter((entry) => entry.state === "drafted");
  if (overdueRequests.length === 0 && drafted.length === 0) env.print("nothing is overdue");
  for (const { entry, days } of overdueRequests) {
    env.print(`${entry.broker}: sent ${entry.dates.sent}, due ${entry.dates.due}, ${days} ${days === 1 ? "day" : "days"} overdue`);
  }
  for (const entry of drafted) env.print(`${entry.broker}: drafted ${entry.dates.drafted}, not sent`);
  return overdueRequests.length > 0 ? 1 : 0;
}

function findPlaybook(broker: string, env: CliEnv): Playbook {
  const playbook = loadPlaybooks(env.brokersDir).find((p) => p.name === broker);
  if (!playbook) throw new Error(`no playbook for ${broker} in ${env.brokersDir}/`);
  return playbook;
}

function isCalendarDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function defaultEnv(): CliEnv {
  return {
    ledgerPath: DEFAULT_LEDGER_PATH,
    brokersDir: "brokers",
    subjectPath: DEFAULT_SUBJECT_PATH,
    today: localDate(new Date()),
    print: (line) => console.log(line),
    deliver: submitWebForm,
  };
}

function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
