// The privacy-guard command line: `due`, `report`, `draft`, `send`, `reply`, `escalate`, `receipt`, `discard`.
import {
  DEFAULT_LEDGER_PATH,
  type Ledger,
  type LedgerEntry,
  dueOn,
  escalatedWithoutReply,
  isCalendarDate,
  isOverdue,
  loadLedger,
  openRequest,
  overdueOn,
  recordSent,
  recordSubmitted,
  saveLedger,
  sentWithoutDueDate,
  stateDate,
  submittedWithoutReceipt,
} from "./ledger.ts";
import { DEFAULT_BROKERS_DIR, type Playbook, loadPlaybooks } from "./playbook.ts";
import { type ReceiptReading, readReceipt } from "./receipt.ts";
import { formatSubmission, renderFields } from "./render.ts";
import {
  type Deliver,
  MAX_RESPONSE_BYTES,
  type Outcome,
  TIMEOUT_MS,
  failureOf,
  guardedSend,
  httpDeliver,
  isPreConnection,
} from "./send.ts";
import { DEFAULT_SUBJECT_PATH, loadSubject } from "./subject.ts";

export interface CliEnv {
  ledgerPath: string;
  /** The directory of playbooks, brokers/<name>.yaml. */
  brokersDir: string;
  subjectPath: string;
  /** ISO calendar date, YYYY-MM-DD. */
  today: string;
  print: (line: string) => void;
  /** Submits a confirmed send; `httpDeliver` by default, a fake in tests. */
  deliver: Deliver;
}

const SEND_FLAGS = ["--confirm", "--show"];

const USAGE = "usage: privacy-guard <due | report | draft <broker> [--show] | send <broker> [--confirm] [--show] | reply <broker> [YYYY-MM-DD] | escalate <broker> [YYYY-MM-DD] | receipt <broker> [reference] | discard <broker>>";

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
    case "send": {
      const [broker, ...extraBrokers] = flags.filter((arg) => !arg.startsWith("--"));
      if (broker === undefined) break;
      // One approval reaches one broker; a shell-expanded broker-{a,b} arrives here as two arguments,
      // and a mistyped flag is refused rather than read as a dry run.
      const extra = [...flags.filter((arg) => arg.startsWith("--") && !SEND_FLAGS.includes(arg)), ...extraBrokers];
      if (extra.length > 0) {
        env.print(`send takes one broker and only --confirm and --show; refusing: ${extra.join(" ")}. Nothing was sent.`);
        return 1;
      }
      return send(broker, { confirm: flags.includes("--confirm"), show: flags.includes("--show") }, env);
    }
    case "reply":
    case "escalate": {
      const [broker, date] = flags;
      // These take no flags; a flag where the date goes is a mistyped command, not a bad date.
      if (broker === undefined || flags.length > 2 || flags.some((arg) => arg.startsWith("--"))) break;
      return (command === "reply" ? reply : escalate)(broker, date ?? env.today, env);
    }
    case "receipt": {
      const [broker, reference] = flags;
      if (broker === undefined || flags.length > 2 || flags.some((arg) => arg.startsWith("--"))) break;
      return receipt(broker, reference, env);
    }
    case "discard": {
      const [broker] = flags;
      if (broker === undefined || flags.length > 1 || flags.some((arg) => arg.startsWith("--"))) break;
      return discard(broker, env);
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
    // A confirmed send that may have reached the broker stays visible until the human resolves it.
    ...submittedWithoutReceipt(ledger).map((entry) => `${entry.broker}: submitted ${entry.dates.submitted}, no receipt`),
    // The human took it to the authority; it stays red every day until `reply` records the broker's answer.
    ...escalatedWithoutReply(ledger).map((entry) => `${entry.broker}: ${stateAndDate(entry)}, no reply`),
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
  const playbook = findPlaybook(broker, env);
  if (playbook === undefined) return 1;
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
    const found = foundInstead(ledger, broker, open?.entry);
    env.print(`${broker} has no sent or escalated request: found ${found === undefined ? "no request" : stateAndDate(found)}`);
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

// The human takes an overdue request to the supervisory authority; privacy-guard only records that they did.
function escalate(broker: string, date: string, env: CliEnv): number {
  const ledger = loadLedger(env.ledgerPath);
  const open = openRequest(ledger, broker);
  if (open === undefined || !isOverdue(open.entry, env.today)) {
    env.print(`${broker}: ${escalateRefusal(foundInstead(ledger, broker, open?.entry), env.today)}`);
    return 1;
  }
  const { entry } = open;
  const refusal = dateRefusal(date, entry.dates.sent, env.today);
  if (refusal !== undefined) {
    env.print(refusal);
    return 1;
  }
  entry.state = "escalated";
  entry.dates.escalated = date;
  saveLedger(env.ledgerPath, ledger);
  env.print(`recorded ${broker} as escalated ${date}; it stays in report until a reply is recorded`);
  return 0;
}

// Why the broker's open request, if any, cannot be escalated today.
function escalateRefusal(entry: LedgerEntry | undefined, today: string): string {
  if (entry === undefined) return "no request to escalate";
  if (entry.state === "escalated") return `already ${stateAndDate(entry)}`;
  if (entry.state !== "sent") return `only an overdue sent request can be escalated; found ${stateAndDate(entry)}`;
  if (entry.dates.due === undefined) return `not overdue: ${stateAndDate(entry)} has no due date recorded`;
  return `not overdue until after its due date, ${entry.dates.due} (today is ${today})`;
}

// The human's word that a submission without a receipt arrived, with the reference from the broker's mail if any.
// The request is sent from the submission date (D-16), so its due date never lies later than the law allows.
function receipt(broker: string, reference: string | undefined, env: CliEnv): number {
  if (reference !== undefined) {
    const playbook = findPlaybook(broker, env);
    if (playbook === undefined) return 1;
    // The whole reference, not a match inside it: the human typed it, there is no page around it.
    const pattern = playbook.receipt.reference_pattern;
    if (!new RegExp(`^(?:${pattern})$`).test(reference)) {
      env.print(`reference "${reference}" does not match ${broker}'s reference pattern ${pattern}`);
      return 1;
    }
  }
  const ledger = loadLedger(env.ledgerPath);
  const entry = findSubmittedWithoutReceipt(ledger, broker, env);
  if (entry === undefined) return 1;
  recordSent(entry, reference, env.today);
  saveLedger(env.ledgerPath, ledger);
  env.print(
    reference === undefined
      ? `recorded ${broker} as sent ${entry.dates.sent}, due ${entry.dates.due}, no reference`
      : `recorded receipt ${reference} for ${broker}: sent ${entry.dates.sent}, due ${entry.dates.due}`,
  );
  return 0;
}

// The human's word that a submission without a receipt did not arrive, or is withdrawn. The ledger forgets
// it (D-15), so the broker has no open request and `draft` works again. Nothing is sent.
function discard(broker: string, env: CliEnv): number {
  const ledger = loadLedger(env.ledgerPath);
  const entry = findSubmittedWithoutReceipt(ledger, broker, env);
  if (entry === undefined) return 1;
  ledger.entries.splice(ledger.entries.indexOf(entry), 1);
  saveLedger(env.ledgerPath, ledger);
  env.print(`discarded ${broker}: drafted ${entry.dates.drafted ?? "(date not recorded)"}, submitted ${entry.dates.submitted}`);
  return 0;
}

// The broker's `drafted` entry with a submission that got no receipt; otherwise prints what it found instead.
function findSubmittedWithoutReceipt(ledger: Ledger, broker: string, env: CliEnv): LedgerEntry | undefined {
  const open = openRequest(ledger, broker)?.entry;
  if (open?.state === "drafted" && open.dates.submitted !== undefined) return open;
  const found = foundInstead(ledger, broker, open);
  const what = found === undefined ? "no request" : `${stateAndDate(found)}${found.state === "drafted" ? ", not submitted" : ""}`;
  env.print(`${broker} has no submission without a receipt: found ${what}`);
  return undefined;
}

// What a refusal names: the broker's open request, or with none its latest (acknowledged) entry, if any.
function foundInstead(ledger: Ledger, broker: string, open: LedgerEntry | undefined): LedgerEntry | undefined {
  return open ?? ledger.entries.filter((entry) => entry.broker === broker).at(-1);
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

// One broker's one drafted request, through the guard. A confirmed send that may have reached the
// broker without a receipt is recorded as submitted and stays drafted, so `report` keeps showing it.
async function send(broker: string, { confirm, show }: { confirm: boolean; show: boolean }, env: CliEnv): Promise<number> {
  const playbook = findPlaybook(broker, env);
  if (playbook === undefined) return 1;
  const ledger = loadLedger(env.ledgerPath);
  const drafted = ledger.entries.filter((entry) => entry.broker === broker && entry.state === "drafted");
  if (drafted.length === 0) {
    env.print(`no drafted request for ${broker}. Draft one first: privacy-guard draft ${broker}`);
    return 1;
  }
  if (drafted.length > 1) {
    env.print(`${broker} has ${drafted.length} drafted requests in ${env.ledgerPath}; expected one. Nothing was sent.`);
    return 1;
  }
  const [entry] = drafted;
  const submitted = entry.dates.submitted;
  if (submitted !== undefined) {
    env.print(`a submission on ${submitted} got no receipt; check ${playbook.display_name}'s mail before sending again`);
  }
  let fields;
  try {
    fields = renderFields(playbook.form.fields, loadSubject(env.subjectPath));
  } catch (error) {
    env.print((error as Error).message);
    return 1;
  }

  const request = { broker, url: playbook.form.url, fields: fields.map(({ name, value }) => ({ name, value })) };
  let result;
  try {
    result = await guardedSend(request, { confirm, deliver: env.deliver });
  } catch (error) {
    result = { sent: true as const, outcome: failureOf(error) };
  }
  if (!result.sent) {
    env.print("dry run: nothing was sent. A real send needs --confirm.");
    for (const line of formatSubmission(playbook.form, fields, show)) env.print(line);
    if (!show) env.print(`Subject values are hidden. To see them: privacy-guard send ${broker} --show`);
    return 0;
  }

  const { outcome } = result;
  if (isPreConnection(outcome)) {
    env.print(`nothing was sent to ${broker}: the connection failed (${outcome.code})`);
    return 1;
  }
  const reading = outcome.kind === "response" && isSuccess(outcome.status) ? readReceipt(outcome.body, playbook) : undefined;
  const reference = reading !== undefined && "reference" in reading ? reading.reference : undefined;
  if (reference !== undefined) recordSent(entry, reference, env.today);
  else recordSubmitted(entry, env.today);
  try {
    saveLedger(env.ledgerPath, ledger);
  } catch (error) {
    // The request may have reached the broker; a lost record would leave `report` silent about it.
    env.print(`the request may have reached ${broker}, but ${env.ledgerPath} could not be written: ${(error as Error).message}`);
    env.print(
      reference === undefined
        ? `Record it by hand: state drafted, dates.submitted ${entry.dates.submitted}.`
        : `Record it by hand: state sent, reference ${reference}, dates.sent ${entry.dates.sent}, dates.due ${entry.dates.due}.`,
    );
    return 1;
  }
  if (reference !== undefined) {
    env.print(`sent to ${broker}, receipt ${reference}, due ${entry.dates.due}`);
    return 0;
  }
  env.print(`${broker} ${noReceiptCase(outcome, reading)}; the request may or may not have arrived.`);
  env.print(`Check ${playbook.display_name}'s mail before sending again.`);
  return 1;
}

const statusClass = (status: number) => Math.floor(status / 100);
const isSuccess = (status: number) => statusClass(status) === 2;

// Names what happened, never the page's text: the broker's response is untrusted content.
function noReceiptCase(outcome: Outcome, reading: ReceiptReading | undefined): string {
  if (outcome.kind === "failed") {
    if (outcome.reason === "timeout") return `timed out after ${TIMEOUT_MS / 1000} seconds`;
    if (outcome.reason === "too-large") return `answered with more than ${MAX_RESPONSE_BYTES / (1024 * 1024)} MB, which was not read`;
    return `could not be reached to the end (${outcome.code ?? "no error code"})`;
  }
  if (statusClass(outcome.status) === 3) return `answered ${outcome.status}, a redirect, which was not followed`;
  if (!isSuccess(outcome.status)) return `answered ${outcome.status}`;
  if (reading !== undefined && "missing" in reading && reading.missing === "form-returned") {
    return `answered ${outcome.status} with the form again`;
  }
  return `answered ${outcome.status} without a receipt reference`;
}

function findPlaybook(broker: string, env: CliEnv): Playbook | undefined {
  const playbook = loadPlaybooks(env.brokersDir).find((candidate) => candidate.name === broker);
  if (playbook === undefined) env.print(`no playbook for ${broker} in ${env.brokersDir}`);
  return playbook;
}

function defaultEnv(): CliEnv {
  return {
    ledgerPath: DEFAULT_LEDGER_PATH,
    brokersDir: DEFAULT_BROKERS_DIR,
    subjectPath: DEFAULT_SUBJECT_PATH,
    today: localDate(new Date()),
    print: (line) => console.log(line),
    deliver: httpDeliver,
  };
}

function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
