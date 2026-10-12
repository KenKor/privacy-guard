// The privacy-guard command line: `due`, `draft`, `send`.
import { DEFAULT_LEDGER_PATH, dueOn, loadLedger, openRequest, saveLedger } from "./ledger.ts";
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

const USAGE = "usage: privacy-guard <due | draft <broker> [--show] | send [--confirm]>";

/** Runs one command and returns the process exit code. */
export async function main(argv: string[], env: CliEnv = defaultEnv()): Promise<number> {
  const [command, ...flags] = argv;
  switch (command) {
    case "due":
      return due(env);
    case "draft": {
      const [broker] = flags.filter((arg) => !arg.startsWith("--"));
      if (broker === undefined) break;
      return draft(broker, flags.includes("--show"), env);
    }
    case "send":
      return send(flags.includes("--confirm"), env);
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
    const { entry, date } = open;
    env.print(`${broker} already has an open request: ${entry.state}${date === undefined ? "" : ` ${date}`}`);
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
