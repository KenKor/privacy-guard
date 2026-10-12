import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "node-html-parser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.ts";
import { type LedgerEntry, saveLedger } from "../src/ledger.ts";
import { type Deliver, type Outcome, type SendRequest, guardedSend } from "../src/send.ts";

// No test contacts a broker. send turns a thrown deliver into an outcome, so the check is in afterEach.
let reachedNoDeliver = false;
const noDeliver: Deliver = () => {
  reachedNoDeliver = true;
  throw new Error("this test must not deliver");
};
afterEach(() => {
  const reached = reachedNoDeliver;
  reachedNoDeliver = false;
  expect(reached, "a test reached deliver without injecting one").toBe(false);
});

const tmpLedger = () => join(mkdtempSync(join(tmpdir(), "cli-")), "ledger.json");

/** A temporary ledger file holding `entries`; returns its path. */
function withLedger(entries: LedgerEntry[]): string {
  const ledgerPath = tmpLedger();
  saveLedger(ledgerPath, { entries });
  return ledgerPath;
}

async function run(
  argv: string[],
  ledgerPath = tmpLedger(),
  {
    brokersDir = "brokers",
    subjectPath = "subject.example.yaml",
    today = "2026-10-12",
    deliver = noDeliver,
  }: { brokersDir?: string; subjectPath?: string; today?: string; deliver?: Deliver } = {},
) {
  const lines: string[] = [];
  const env = { ledgerPath, brokersDir, subjectPath, today, deliver, print: (line: string) => lines.push(line) };
  const code = await main(argv, env);
  return { code, output: lines.join("\n") };
}

describe("privacy-guard due", () => {
  it("says nothing is due on an empty ledger", async () => {
    expect(await run(["due"])).toEqual({ code: 0, output: "nothing is due" });
  });

  it("lists the requests due today", async () => {
    const ledgerPath = withLedger([
      { broker: "broker-a", state: "sent", dates: { sent: "2026-09-12", due: "2026-10-12" } },
      { broker: "broker-b", state: "sent", dates: { sent: "2026-10-01", due: "2026-11-01" } },
    ]);
    const { code, output } = await run(["due"], ledgerPath);
    expect(code).toBe(0);
    expect(output).toContain("broker-a");
    expect(output).not.toContain("broker-b");
  });
});

describe("privacy-guard report", () => {
  const sentToBrokerA: LedgerEntry = { broker: "broker-a", state: "sent", dates: { sent: "2026-10-12", due: "2026-11-12" } };

  it("says nothing is overdue on an empty ledger", async () => {
    expect(await run(["report"])).toEqual({ code: 0, output: "nothing is overdue" });
  });

  it("says nothing is overdue on the due date itself", async () => {
    expect(await run(["report"], withLedger([sentToBrokerA]), { today: "2026-11-12" })).toEqual({ code: 0, output: "nothing is overdue" });
  });

  it("lists a request the day after its due date and fails, so a scheduled job notices", async () => {
    expect(await run(["report"], withLedger([sentToBrokerA]), { today: "2026-11-13" })).toEqual({
      code: 1,
      output: "broker-a: sent 2026-10-12, due 2026-11-12, 1 day overdue",
    });
  });

  it("lists every overdue request, one line each", async () => {
    const ledgerPath = withLedger([
      sentToBrokerA,
      { broker: "broker-b", state: "sent", dates: { sent: "2026-10-01", due: "2026-11-01" } },
    ]);
    expect(await run(["report"], ledgerPath, { today: "2026-11-13" })).toEqual({
      code: 1,
      output: [
        "broker-a: sent 2026-10-12, due 2026-11-12, 1 day overdue",
        "broker-b: sent 2026-10-01, due 2026-11-01, 12 days overdue",
      ].join("\n"),
    });
  });

  it("warns about a sent request with no due date and fails: it cannot be judged", async () => {
    const ledgerPath = withLedger([{ broker: "broker-x", state: "sent", dates: { sent: "2026-09-01" } }]);
    expect(await run(["report"], ledgerPath)).toEqual({ code: 1, output: "broker-x: sent 2026-09-01, no due date recorded" });
  });

  it("lists overdue requests first, then the requests it cannot judge", async () => {
    const ledgerPath = withLedger([{ broker: "broker-x", state: "sent", dates: { sent: "2026-09-01" } }, sentToBrokerA]);
    expect(await run(["report"], ledgerPath, { today: "2026-11-13" })).toEqual({
      code: 1,
      output: ["broker-a: sent 2026-10-12, due 2026-11-12, 1 day overdue", "broker-x: sent 2026-09-01, no due date recorded"].join(
        "\n",
      ),
    });
  });

  it("says so when a hand-written entry has no sent date", async () => {
    const ledgerPath = withLedger([{ broker: "broker-x", state: "sent", dates: {} }]);
    expect(await run(["report"], ledgerPath)).toEqual({
      code: 1,
      output: "broker-x: sent (date not recorded), no due date recorded",
    });
  });

  it("lists a submission without a receipt last and fails until it is resolved", async () => {
    const ledgerPath = withLedger([
      { broker: "broker-b", state: "drafted", dates: { drafted: "2026-10-12", submitted: "2026-10-12" } },
      sentToBrokerA,
    ]);
    expect(await run(["report"], ledgerPath, { today: "2026-11-13" })).toEqual({
      code: 1,
      output: ["broker-a: sent 2026-10-12, due 2026-11-12, 1 day overdue", "broker-b: submitted 2026-10-12, no receipt"].join("\n"),
    });
  });

  it("never lists acknowledged or drafted requests", async () => {
    const ledgerPath = withLedger([
      { broker: "answered", state: "acknowledged", dates: { sent: "2026-09-01", acknowledged: "2026-09-20", due: "2026-10-01" } },
      { broker: "drafted", state: "drafted", dates: { drafted: "2026-09-01" } },
    ]);
    expect(await run(["report"], ledgerPath)).toEqual({ code: 0, output: "nothing is overdue" });
  });
});

describe("privacy-guard send", () => {
  const drafted = (dates: LedgerEntry["dates"] = {}): LedgerEntry => ({
    broker: "broker-a",
    state: "drafted",
    dates: { drafted: "2026-10-12", ...dates },
  });
  const withDraft = (dates?: LedgerEntry["dates"]) => withLedger([drafted(dates)]);
  const entriesIn = (ledgerPath: string): LedgerEntry[] => JSON.parse(readFileSync(ledgerPath, "utf8")).entries;
  const answered = (status: number, body: string) => async (): Promise<Outcome> => ({ kind: "response", status, body });
  const failed = (reason: "timeout" | "too-large" | "error", code?: string) => async (): Promise<Outcome> =>
    reason === "error" ? { kind: "failed", reason, code } : { kind: "failed", reason };
  const receiptPage = '<html><body><p id="thanks">Your reference is <strong id="reference">BA-482915</strong>.</p></body></html>';
  const exampleValues = ["Alex Example", "alex.example@example.org", "+00 000 000 000", "Test Engineer"];
  const confirmed = (...rest: string[]) => ["send", "broker-a", "--confirm", ...rest];

  // Changed under docs/prds/reviewed/opt-out-broker-a.md, plan item 7 (send takes one broker; usage without one).
  it("without a broker prints usage", async () => {
    const { code, output } = await run(["send", "--confirm"]);
    expect(code).toBe(2);
    expect(output).toContain("usage: privacy-guard");
  });

  it("refuses more than one broker, naming the extra ones, and sends nothing", async () => {
    const deliver = vi.fn(answered(200, receiptPage));
    const ledgerPath = withDraft();
    const { code, output } = await run(confirmed("broker-b", "broker-c"), ledgerPath, { deliver });
    expect(code).toBe(1);
    expect(output).toMatch(/broker-b broker-c/);
    expect(output).toMatch(/nothing was sent/i);
    expect(deliver).not.toHaveBeenCalled();
    expect(entriesIn(ledgerPath)).toEqual([drafted()]);
  });

  it("refuses a flag it does not know, naming it, rather than reading it as a dry run", async () => {
    const { code, output } = await run(["send", "--confrim", "broker-a"], withDraft());
    expect(code).toBe(1);
    expect(output).toMatch(/refusing: --confrim\. Nothing was sent/);
  });

  // Changed under docs/prds/reviewed/opt-out-broker-a.md, plan item 7 (the dry run prints the submission, run as `send broker-a`).
  it("without --confirm prints the submission masked and contacts nothing", async () => {
    const deliver = vi.fn(answered(200, receiptPage));
    const ledgerPath = withDraft();
    const { code, output } = await run(["send", "broker-a"], ledgerPath, { deliver });
    expect(code).toBe(0);
    expect(output).toMatch(/^dry run: nothing was sent/i);
    expect(output).toContain("POST http://localhost:8080/  (form#opt-out-form)");
    expect(output).toMatch(/email\s+\[subject\.email\]/);
    expect(output).toMatch(/request_type\s+both/);
    for (const value of exampleValues) expect(output).not.toContain(value);
    expect(deliver).not.toHaveBeenCalled();
    expect(entriesIn(ledgerPath)).toEqual([drafted()]);
  });

  it("with --show, before or after the broker, prints the subject's values", async () => {
    for (const argv of [["send", "broker-a", "--show"], ["send", "--show", "broker-a"]]) {
      const { code, output } = await run(argv, withDraft());
      expect(code).toBe(0);
      for (const value of exampleValues) expect(output).toContain(value);
    }
  });

  it("refuses a broker with no playbook", async () => {
    const { code, output } = await run(["send", "broker-z"], withDraft());
    expect(code).toBe(1);
    expect(output).toMatch(/no playbook for broker-z/);
  });

  it("refuses a broker with no drafted request", async () => {
    const ledgerPath = withLedger([{ broker: "broker-a", state: "sent", dates: { sent: "2026-10-01", due: "2026-11-01" } }]);
    const { code, output } = await run(["send", "broker-a"], ledgerPath);
    expect(code).toBe(1);
    expect(output).toMatch(/no drafted request for broker-a/);
  });

  it("refuses a broker with two drafted requests and sends nothing", async () => {
    const deliver = vi.fn(answered(200, receiptPage));
    const ledgerPath = withLedger([drafted(), drafted()]);
    const { code, output } = await run(confirmed(), ledgerPath, { deliver });
    expect(code).toBe(1);
    expect(output).toMatch(/broker-a has 2 drafted requests/);
    expect(deliver).not.toHaveBeenCalled();
  });

  it("with --confirm, before or after the broker, posts the rendered fields to the form's address", async () => {
    for (const argv of [confirmed(), ["send", "--confirm", "broker-a"]]) {
      const deliver = vi.fn(answered(200, receiptPage));
      await run(argv, withDraft(), { deliver });
      expect(deliver).toHaveBeenCalledExactlyOnceWith({
        broker: "broker-a",
        url: "http://localhost:8080/",
        fields: [
          { name: "full_name", value: "Alex Example" },
          { name: "email", value: "alex.example@example.org" },
          { name: "phone", value: "+00 000 000 000" },
          { name: "job_title", value: "Test Engineer" },
          { name: "request_type", value: "both" },
          { name: "confirm_identity", value: "on" },
        ],
      });
    }
  });

  // Changed under docs/prds/reviewed/opt-out-broker-a.md, plan item 7 (a confirmed send with a fake deliver now succeeds).
  it("on a receipt records the request as sent, with its reference and due date", async () => {
    const ledgerPath = withDraft();
    const { code, output } = await run(confirmed(), ledgerPath, { deliver: answered(200, receiptPage) });
    expect({ code, output }).toEqual({ code: 0, output: "sent to broker-a, receipt BA-482915, due 2026-11-12" });
    expect(entriesIn(ledgerPath)).toEqual([
      { broker: "broker-a", state: "sent", reference: "BA-482915", dates: { drafted: "2026-10-12", sent: "2026-10-12", due: "2026-11-12" } },
    ]);
  });

  it("on a re-send's receipt dates the request from the first submission", async () => {
    const ledgerPath = withDraft({ submitted: "2026-10-12" });
    const { code, output } = await run(confirmed(), ledgerPath, { deliver: answered(200, receiptPage), today: "2026-10-14" });
    expect(code).toBe(0);
    expect(output).toContain("sent to broker-a, receipt BA-482915, due 2026-11-12");
    expect(entriesIn(ledgerPath)[0]).toMatchObject({
      state: "sent",
      reference: "BA-482915",
      dates: { submitted: "2026-10-12", sent: "2026-10-12", due: "2026-11-12" },
    });
  });

  it("on a receipt with no earlier submission dates the request today", async () => {
    const ledgerPath = withDraft();
    await run(confirmed(), ledgerPath, { deliver: answered(200, receiptPage), today: "2026-10-14" });
    expect(entriesIn(ledgerPath)[0].dates).toEqual({ drafted: "2026-10-12", sent: "2026-10-14", due: "2026-11-14" });
  });

  // Changed under docs/prds/reviewed/opt-out-broker-a.md, plan item 7 (replaces "not implemented yet": a pre-connection failure).
  it.each(["ECONNREFUSED", "ENOTFOUND"])("after a pre-connection failure (%s) says nothing was sent and leaves the request unchanged", async (code) => {
    const ledgerPath = withDraft();
    const deliver = failed("error", code);
    const result = await run(confirmed(), ledgerPath, { deliver });
    expect(result.code).toBe(1);
    expect(result.output).toMatch(new RegExp(`nothing was sent to broker-a.*${code}`));
    expect(entriesIn(ledgerPath)).toEqual([drafted()]);
  });

  it("after a pre-connection failure keeps an earlier submission date", async () => {
    const ledgerPath = withDraft({ submitted: "2026-10-10" });
    const deliver = failed("error", "ECONNREFUSED");
    await run(confirmed(), ledgerPath, { deliver });
    expect(entriesIn(ledgerPath)).toEqual([drafted({ submitted: "2026-10-10" })]);
  });

  const indexHtml = readFileSync("sites/broker-a/index.html", "utf8");
  const notice = parse(indexHtml).querySelector(".notice-for-processing")!.toString();
  const mayHaveReached: [string, Deliver, RegExp][] = [
    ["a timeout", failed("timeout"), /timed out/],
    ["a reset after sending", failed("error", "UND_ERR_SOCKET"), /UND_ERR_SOCKET/],
    ["a failure with no cause code", failed("error"), /no error code/],
    ["a thrown failure", () => Promise.reject(new TypeError("fetch failed")), /no error code/],
    ["an error status", answered(500, `<p id="thanks">BA-482915</p>${notice}`), /answered 500/],
    ["a redirect", answered(303, ""), /answered 303.*not followed/],
    ["a response over the cap", failed("too-large"), /more than 1 MB/],
    ["the form returned", answered(200, indexHtml), /the form again/],
    ["no reference", answered(200, `<p id="thanks">Thank you.</p>${notice}`), /without a receipt reference/],
  ];

  it.each(mayHaveReached)("after %s keeps the request drafted with the submission date, and report lists it", async (_, deliver, says) => {
    const ledgerPath = withDraft();
    const { code, output } = await run(confirmed(), ledgerPath, { deliver });
    expect(code).toBe(1);
    expect(output).toMatch(says);
    expect(output).toMatch(/may or may not have arrived/);
    expect(output).toContain("Check Broker A's mail before sending again.");
    expect(output).not.toMatch(/notice|instructions|attacker/i);
    expect(entriesIn(ledgerPath)).toEqual([drafted({ submitted: "2026-10-12" })]);
    expect(await run(["report"], ledgerPath)).toEqual({ code: 1, output: "broker-a: submitted 2026-10-12, no receipt" });
  });

  // Root ignores file modes, so a read-only ledger cannot make the write fail there.
  it.skipIf(process.getuid?.() === 0).each([
    ["a receipt", answered(200, receiptPage), /state sent, reference BA-482915, dates\.sent 2026-10-12, dates\.due 2026-11-12/],
    ["no receipt", failed("timeout"), /state drafted, dates\.submitted 2026-10-12/],
  ])("after %s, a ledger that cannot be written says what to record by hand and fails", async (_, deliver, record) => {
    const ledgerPath = withDraft();
    chmodSync(ledgerPath, 0o444);
    const { code, output } = await run(confirmed(), ledgerPath, { deliver });
    expect(code).toBe(1);
    expect(output).toMatch(/the request may have reached broker-a, but .* could not be written/);
    expect(output).toMatch(record);
    expect(entriesIn(ledgerPath)).toEqual([drafted()]);
  });

  it("after a second failure keeps the first submission date", async () => {
    const ledgerPath = withDraft({ submitted: "2026-10-12" });
    const deliver = failed("timeout");
    expect((await run(confirmed(), ledgerPath, { deliver, today: "2026-10-14" })).code).toBe(1);
    expect(entriesIn(ledgerPath)).toEqual([drafted({ submitted: "2026-10-12" })]);
  });

  it("warns first when an earlier submission got no receipt, dry run and confirmed", async () => {
    const warning = "a submission on 2026-10-12 got no receipt; check Broker A's mail before sending again";
    const dryRun = await run(["send", "broker-a"], withDraft({ submitted: "2026-10-12" }), { today: "2026-10-14" });
    expect(dryRun.output.split("\n")[0]).toBe(warning);
    const sent = await run(confirmed(), withDraft({ submitted: "2026-10-12" }), { deliver: answered(200, receiptPage), today: "2026-10-14" });
    expect(sent.output.split("\n")).toEqual([warning, "sent to broker-a, receipt BA-482915, due 2026-11-12"]);
  });
});

describe("privacy-guard draft", () => {
  const exampleValues = ["Alex Example", "alex.example@example.org", "+00 000 000 000", "Test Engineer"];
  const tmpFile = (name: string, text: string) => {
    const path = join(mkdtempSync(join(tmpdir(), "draft-")), name);
    writeFileSync(path, text);
    return path;
  };

  it("prints the submission with every subject value masked", async () => {
    const { code, output } = await run(["draft", "broker-a"]);
    expect(code).toBe(0);
    expect(output).toContain("POST http://localhost:8080/  (form#opt-out-form)");
    expect(output).toMatch(/full_name\s+\[subject\.full_name\]/);
    expect(output).toMatch(/email\s+\[subject\.email\]/);
    expect(output).toMatch(/request_type\s+both/);
    expect(output).toMatch(/confirm_identity\s+on/);
    expect(output).toContain("--show");
    for (const value of exampleValues) expect(output).not.toContain(value);
  });

  it("with --show prints every subject value", async () => {
    const { code, output } = await run(["draft", "broker-a", "--show"]);
    expect(code).toBe(0);
    for (const value of exampleValues) expect(output).toContain(value);
  });

  it("records a drafted entry with the broker and the date only", async () => {
    const ledgerPath = tmpLedger();
    await run(["draft", "broker-a"], ledgerPath);
    expect(JSON.parse(readFileSync(ledgerPath, "utf8"))).toEqual({
      entries: [{ broker: "broker-a", state: "drafted", dates: { drafted: "2026-10-12" } }],
    });
  });

  it("renders a subject without phone with phone empty", async () => {
    const subjectPath = tmpFile("subject.yaml", 'full_name: "Alex Example"\nemail: "alex.example@example.org"\n');
    const { code, output } = await run(["draft", "broker-a"], tmpLedger(), { subjectPath });
    expect(code).toBe(0);
    expect(output).toMatch(/phone\s+\(empty\)/);
  });

  it("refuses a subject without email, naming email and no value, and writes nothing", async () => {
    const ledgerPath = tmpLedger();
    const subjectPath = tmpFile("subject.yaml", 'full_name: "Alex Example"\n');
    const { code, output } = await run(["draft", "broker-a", "--show"], ledgerPath, { subjectPath });
    expect(code).toBe(1);
    expect(output).toContain('"email"');
    expect(output).not.toContain("Alex");
    expect(existsSync(ledgerPath)).toBe(false);
  });

  it("refuses a failed render and writes nothing to the ledger", async () => {
    const ledgerPath = tmpLedger();
    const brokerA = readFileSync("brokers/broker-a.yaml", "utf8").replace("{{ subject.phone | optional }}", "{{ subject.city }}");
    const brokersDir = join(tmpFile("broker-a.yaml", brokerA), "..");
    const { code, output } = await run(["draft", "broker-a"], ledgerPath, { brokersDir });
    expect(code).toBe(1);
    expect(output).toMatch(/"phone".*subject\.city/);
    expect(existsSync(ledgerPath)).toBe(false);
  });

  it("refuses a broker with no playbook", async () => {
    const ledgerPath = tmpLedger();
    const { code, output } = await run(["draft", "broker-z"], ledgerPath);
    expect(code).toBe(1);
    expect(output).toMatch(/no playbook for broker-z/);
    expect(existsSync(ledgerPath)).toBe(false);
  });

  it("refuses a broker with an open request, naming its state and date", async () => {
    const ledgerPath = tmpLedger();
    const entries = [{ broker: "broker-a", state: "sent" as const, dates: { sent: "2026-09-30", due: "2026-10-30" } }];
    saveLedger(ledgerPath, { entries });
    const { code, output } = await run(["draft", "broker-a"], ledgerPath);
    expect(code).toBe(1);
    expect(output).toMatch(/broker-a already has an open request: sent 2026-09-30/);
    expect(JSON.parse(readFileSync(ledgerPath, "utf8"))).toEqual({ entries });
  });

  it("refuses a second draft for the same broker", async () => {
    const ledgerPath = tmpLedger();
    await run(["draft", "broker-a"], ledgerPath);
    const { code, output } = await run(["draft", "broker-a"], ledgerPath);
    expect(code).toBe(1);
    expect(output).toMatch(/broker-a already has an open request: drafted 2026-10-12/);
    expect(JSON.parse(readFileSync(ledgerPath, "utf8")).entries).toHaveLength(1);
  });

  it("drafts again once the earlier request is acknowledged", async () => {
    const ledgerPath = tmpLedger();
    saveLedger(ledgerPath, {
      entries: [{ broker: "broker-a", state: "acknowledged", dates: { sent: "2026-08-01", acknowledged: "2026-08-20" } }],
    });
    expect((await run(["draft", "broker-a"], ledgerPath)).code).toBe(0);
    expect(JSON.parse(readFileSync(ledgerPath, "utf8")).entries).toHaveLength(2);
  });

  it("without a broker prints usage", async () => {
    const { code, output } = await run(["draft"]);
    expect(code).toBe(2);
    expect(output).toContain("usage: privacy-guard");
  });
});

describe("privacy-guard reply", () => {
  const sentToBrokerA: LedgerEntry = { broker: "broker-a", state: "sent", dates: { sent: "2026-10-12", due: "2026-11-12" } };
  const entriesOf = (ledgerPath: string) => JSON.parse(readFileSync(ledgerPath, "utf8")).entries;

  it("marks a sent request acknowledged today by default", async () => {
    const ledgerPath = withLedger([sentToBrokerA]);
    const { code, output } = await run(["reply", "broker-a"], ledgerPath, { today: "2026-11-05" });
    expect(code).toBe(0);
    expect(output).toBe("recorded broker-a as acknowledged 2026-11-05");
    expect(entriesOf(ledgerPath)).toEqual([
      { broker: "broker-a", state: "acknowledged", dates: { sent: "2026-10-12", due: "2026-11-12", acknowledged: "2026-11-05" } },
    ]);
  });

  it("marks an escalated request (a hand-written ledger) acknowledged on the given date", async () => {
    const escalated = { ...sentToBrokerA, state: "escalated" as const };
    const ledgerPath = withLedger([escalated]);
    const { code, output } = await run(["reply", "broker-a", "2026-11-20"], ledgerPath, { today: "2026-11-25" });
    expect(code).toBe(0);
    expect(output).toBe("recorded broker-a as acknowledged 2026-11-20");
    expect(entriesOf(ledgerPath)).toEqual([
      { broker: "broker-a", state: "acknowledged", dates: { sent: "2026-10-12", due: "2026-11-12", acknowledged: "2026-11-20" } },
    ]);
  });

  it("takes an overdue request out of report", async () => {
    const ledgerPath = withLedger([sentToBrokerA]);
    expect((await run(["report"], ledgerPath, { today: "2026-11-13" })).code).toBe(1);
    expect((await run(["reply", "broker-a", "2026-11-13"], ledgerPath, { today: "2026-11-13" })).code).toBe(0);
    expect(await run(["report"], ledgerPath, { today: "2026-11-13" })).toEqual({ code: 0, output: "nothing is overdue" });
  });

  it.each([
    ["no entry", [], "broker-a has no sent or escalated request: found no request"],
    [
      "a drafted entry",
      [{ broker: "broker-a", state: "drafted", dates: { drafted: "2026-10-10" } }],
      "broker-a has no sent or escalated request: found drafted 2026-10-10",
    ],
    [
      "an acknowledged entry",
      [{ broker: "broker-a", state: "acknowledged", dates: { sent: "2026-09-01", acknowledged: "2026-09-20" } }],
      "broker-a has no sent or escalated request: found acknowledged 2026-09-20",
    ],
  ] as [string, LedgerEntry[], string][])("refuses a broker with %s, naming what it found, and writes nothing", async (_, entries, message) => {
    const ledgerPath = withLedger(entries);
    expect(await run(["reply", "broker-a"], ledgerPath)).toEqual({ code: 1, output: message });
    expect(entriesOf(ledgerPath)).toEqual(entries);
  });

  it.each([
    ["a malformed date", "5 Nov 2026", 'date "5 Nov 2026" is not a YYYY-MM-DD date'],
    ["a date that does not exist", "2026-02-30", 'date "2026-02-30" is not a YYYY-MM-DD date'],
    ["a date after today", "2026-11-06", "date 2026-11-06 lies after today, 2026-11-05"],
    ["a date before the sent date", "2026-10-11", "date 2026-10-11 lies before the sent date, 2026-10-12"],
  ])("refuses %s and writes nothing", async (_, date, message) => {
    const ledgerPath = withLedger([sentToBrokerA]);
    expect(await run(["reply", "broker-a", date], ledgerPath, { today: "2026-11-05" })).toEqual({ code: 1, output: message });
    expect(entriesOf(ledgerPath)).toEqual([sentToBrokerA]);
  });

  it("accepts the sent date itself", async () => {
    const ledgerPath = withLedger([sentToBrokerA]);
    expect((await run(["reply", "broker-a", "2026-10-12"], ledgerPath, { today: "2026-11-05" })).code).toBe(0);
  });

  it("without a broker prints usage naming reply", async () => {
    const { code, output } = await run(["reply"]);
    expect(code).toBe(2);
    expect(output).toContain("reply <broker> [YYYY-MM-DD]");
  });

  it("acts on the open request, not an earlier acknowledged one", async () => {
    const earlier: LedgerEntry = { broker: "broker-a", state: "acknowledged", dates: { sent: "2026-08-01", acknowledged: "2026-08-20" } };
    const ledgerPath = withLedger([earlier, sentToBrokerA]);
    expect((await run(["reply", "broker-a"], ledgerPath, { today: "2026-11-05" })).code).toBe(0);
    expect(entriesOf(ledgerPath)).toEqual([
      earlier,
      { broker: "broker-a", state: "acknowledged", dates: { sent: "2026-10-12", due: "2026-11-12", acknowledged: "2026-11-05" } },
    ]);
  });

  it("with a flag prints usage and writes nothing", async () => {
    const ledgerPath = withLedger([sentToBrokerA]);
    const { code, output } = await run(["reply", "broker-a", "--show"], ledgerPath);
    expect(code).toBe(2);
    expect(output).toContain("reply <broker> [YYYY-MM-DD]");
    expect(entriesOf(ledgerPath)).toEqual([sentToBrokerA]);
  });

  it("with an argument after the date prints usage and writes nothing", async () => {
    const ledgerPath = withLedger([sentToBrokerA]);
    const { code, output } = await run(["reply", "broker-a", "2026-11-05", "extra"], ledgerPath, { today: "2026-11-05" });
    expect(code).toBe(2);
    expect(output).toContain("reply <broker> [YYYY-MM-DD]");
    expect(entriesOf(ledgerPath)).toEqual([sentToBrokerA]);
  });
});

describe("privacy-guard with an unknown command", () => {
  it("prints usage and fails", async () => {
    const { code, output } = await run(["frobnicate"]);
    expect(code).toBe(2);
    expect(output).toContain("usage: privacy-guard");
  });
});

describe("guardedSend", () => {
  // Changed under docs/prds/reviewed/opt-out-broker-a.md, plan item 7 (SendRequest carries the address and fields; deliver returns the outcome).
  const request: SendRequest = { broker: "broker-a", url: "http://localhost:8080/", fields: [{ name: "request_type", value: "both" }] };
  const outcome: Outcome = { kind: "response", status: 200, body: "" };

  it("does not deliver without confirmation", async () => {
    const deliver = vi.fn(async () => outcome);
    const result = await guardedSend(request, { confirm: false, deliver });
    expect(result).toEqual({ sent: false, reason: "dry-run" });
    expect(deliver).not.toHaveBeenCalled();
  });

  it("delivers once when confirmed and returns the outcome", async () => {
    const deliver = vi.fn(async () => outcome);
    const result = await guardedSend(request, { confirm: true, deliver });
    expect(result).toEqual({ sent: true, outcome });
    expect(deliver).toHaveBeenCalledExactlyOnceWith(request);
  });
});

describe("the privacy-guard bin", () => {
  it("runs from the repo without a build step", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bin-"));
    const output = execFileSync(process.execPath, [resolve("bin/privacy-guard.js"), "due"], { cwd, encoding: "utf8" });
    expect(output.trim()).toBe("nothing is due");
  });
});
