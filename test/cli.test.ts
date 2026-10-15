import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { type CliEnv, main } from "../src/cli.ts";
import { type LedgerEntry, loadLedger, saveLedger } from "../src/ledger.ts";
import { type Deliver, type DeliveryOutcome, guardedSend } from "../src/send.ts";
import { loadSubject } from "../src/subject.ts";

const subjectValues = Object.values(loadSubject("subject.example.yaml"));

function ledgerWith(entries: LedgerEntry[] = []): string {
  const path = join(mkdtempSync(join(tmpdir(), "cli-")), "ledger.json");
  if (entries.length > 0) saveLedger(path, { entries });
  return path;
}

const noNetwork: Deliver = () => {
  throw new Error("tests make no network request");
};

async function run(argv: string[], env: Partial<CliEnv> = {}) {
  const lines: string[] = [];
  const code = await main(argv, {
    ledgerPath: ledgerWith(),
    brokersDir: "brokers",
    subjectPath: "subject.example.yaml",
    today: "2026-10-12",
    deliver: noNetwork,
    print: (line) => lines.push(line),
    ...env,
  });
  return { code, output: lines.join("\n") };
}

const drafted = (date = "2026-10-12"): LedgerEntry => ({ broker: "broker-a", state: "drafted", dates: { drafted: date } });
const sent = (date = "2026-10-12", due = "2026-11-12"): LedgerEntry => ({
  broker: "broker-a",
  state: "sent",
  reference: "BA-482915",
  dates: { drafted: date, sent: date, due },
});

function expectNoSubjectValue(text: string) {
  for (const value of subjectValues) expect(text).not.toContain(value);
}

describe("privacy-guard draft", () => {
  it("records a drafted request with today's date and prints the masked submission", async () => {
    const ledgerPath = ledgerWith();
    const { code, output } = await run(["draft", "broker-a"], { ledgerPath, today: "2026-10-15" });
    expect(code).toBe(0);
    expect(loadLedger(ledgerPath).entries).toEqual([{ broker: "broker-a", state: "drafted", dates: { drafted: "2026-10-15" } }]);
    expect(output).toContain("http://localhost:8080/");
    expect(output).toContain("[subject.full_name]");
    expect(output).toContain("[subject.email]");
    expect(output).toContain("request_type: both");
    expectNoSubjectValue(output);
    expectNoSubjectValue(readFileSync(ledgerPath, "utf8"));
  });

  it("prints the actual values with --show", async () => {
    const { code, output } = await run(["draft", "broker-a", "--show"]);
    expect(code).toBe(0);
    for (const value of subjectValues) expect(output).toContain(value);
  });

  it("refuses an unknown broker and writes nothing", async () => {
    const ledgerPath = ledgerWith();
    const { code, output } = await run(["draft", "broker-z"], { ledgerPath });
    expect(code).toBe(1);
    expect(output).toContain("broker-z");
    expect(loadLedger(ledgerPath).entries).toEqual([]);
  });

  it("prints usage without a broker", async () => {
    const { code, output } = await run(["draft"]);
    expect(code).toBe(2);
    expect(output).toContain("usage: privacy-guard");
  });

  it("refuses a missing subject file, pointing at the example, and writes nothing", async () => {
    const ledgerPath = ledgerWith();
    const subjectPath = join(mkdtempSync(join(tmpdir(), "cli-")), "subject.yaml");
    const { code, output } = await run(["draft", "broker-a"], { ledgerPath, subjectPath });
    expect(code).toBe(1);
    expect(output).toContain(subjectPath);
    expect(output).toContain("subject.example.yaml");
    expect(loadLedger(ledgerPath).entries).toEqual([]);
  });

  it("refuses while broker-a has a sent request, naming its state and date", async () => {
    const ledgerPath = ledgerWith([sent()]);
    const before = readFileSync(ledgerPath, "utf8");
    const { code, output } = await run(["draft", "broker-a"], { ledgerPath });
    expect(code).toBe(1);
    expect(output).toContain("broker-a has a sent request from 2026-10-12");
    expect(readFileSync(ledgerPath, "utf8")).toBe(before);
  });

  it("refuses while broker-a has a drafted request", async () => {
    const { code, output } = await run(["draft", "broker-a"], { ledgerPath: ledgerWith([drafted("2026-10-01")]) });
    expect(code).toBe(1);
    expect(output).toContain("broker-a has a drafted request from 2026-10-01");
  });

  it("drafts a new request after a reply", async () => {
    const acknowledged: LedgerEntry = { ...sent("2026-09-01", "2026-10-01"), state: "acknowledged" };
    acknowledged.dates.replied = "2026-09-20";
    const ledgerPath = ledgerWith([acknowledged]);
    expect((await run(["draft", "broker-a"], { ledgerPath })).code).toBe(0);
    expect(loadLedger(ledgerPath).entries.map((e) => e.state)).toEqual(["acknowledged", "drafted"]);
  });
});

describe("privacy-guard send", () => {
  it("without --confirm prints the masked submission, contacts nothing, changes nothing", async () => {
    const ledgerPath = ledgerWith([drafted()]);
    const before = readFileSync(ledgerPath, "utf8");
    const deliver = vi.fn(noNetwork);
    const { code, output } = await run(["send", "broker-a"], { ledgerPath, deliver });
    expect(code).toBe(0);
    expect(output).toMatch(/dry run: nothing was sent/i);
    expect(output).toContain("A confirmed send needs --confirm");
    expect(output).toContain("[subject.email]");
    expectNoSubjectValue(output);
    expect(deliver).not.toHaveBeenCalled();
    expect(readFileSync(ledgerPath, "utf8")).toBe(before);
  });

  it("with --show but no --confirm shows the values and sends nothing", async () => {
    const deliver = vi.fn(noNetwork);
    const { code, output } = await run(["send", "broker-a", "--show"], { ledgerPath: ledgerWith([drafted()]), deliver });
    expect(code).toBe(0);
    for (const value of subjectValues) expect(output).toContain(value);
    expect(deliver).not.toHaveBeenCalled();
  });

  it("refuses without a drafted request and contacts nothing", async () => {
    const deliver = vi.fn(noNetwork);
    const { code, output } = await run(["send", "broker-a", "--confirm"], { deliver });
    expect(code).toBe(1);
    expect(output).toContain("broker-a has no drafted request");
    expect(deliver).not.toHaveBeenCalled();
  });

  it("refuses when broker-a's request is already sent", async () => {
    const deliver = vi.fn(noNetwork);
    const { code } = await run(["send", "broker-a", "--confirm"], { ledgerPath: ledgerWith([sent()]), deliver });
    expect(code).toBe(1);
    expect(deliver).not.toHaveBeenCalled();
  });

  it("prints usage without a broker", async () => {
    expect((await run(["send", "--confirm"])).code).toBe(2);
  });

  const confirmed = async (outcome: DeliveryOutcome) => {
    const ledgerPath = ledgerWith([drafted()]);
    const before = readFileSync(ledgerPath, "utf8");
    const deliver = vi.fn(async () => outcome);
    const result = await run(["send", "broker-a", "--confirm"], { ledgerPath, deliver });
    return { ...result, ledgerPath, before, deliver };
  };

  it("with --confirm and a receipt records sent, the reference and the due date", async () => {
    const { code, output, ledgerPath, deliver } = await confirmed({ kind: "receipt", reference: "BA-482915" });
    expect(code).toBe(0);
    expect(deliver).toHaveBeenCalledOnce();
    expect(loadLedger(ledgerPath).entries).toEqual([
      { broker: "broker-a", state: "sent", reference: "BA-482915", dates: { drafted: "2026-10-12", sent: "2026-10-12", due: "2026-11-12" } },
    ]);
    expect(output).toContain("BA-482915");
    expect(output).toContain("sent 2026-10-12");
    expect(output).toContain("due 2026-11-12");
    expectNoSubjectValue(readFileSync(ledgerPath, "utf8"));
  });

  it("with --confirm and a refused send leaves the request drafted", async () => {
    const { code, output, ledgerPath, before } = await confirmed({ kind: "not-sent", reason: "the broker answered 500" });
    expect(code).toBe(1);
    expect(output).toMatch(/not sent/);
    expect(output).toContain("the broker answered 500");
    expect(readFileSync(ledgerPath, "utf8")).toBe(before);
  });

  it("with --confirm and no receipt says it may have arrived and to check the mail", async () => {
    const { code, output, ledgerPath, before } = await confirmed({ kind: "unclear", reason: "no receipt in the answer" });
    expect(code).toBe(1);
    expect(output).toMatch(/may have arrived without a receipt/);
    expect(output).toMatch(/check Broker A's mail before sending again/i);
    expect(readFileSync(ledgerPath, "utf8")).toBe(before);
  });
});

describe("privacy-guard reply", () => {
  it("records a reply today", async () => {
    const ledgerPath = ledgerWith([sent()]);
    const { code } = await run(["reply", "broker-a"], { ledgerPath, today: "2026-11-05" });
    expect(code).toBe(0);
    const [entry] = loadLedger(ledgerPath).entries;
    expect(entry.state).toBe("acknowledged");
    expect(entry.dates.replied).toBe("2026-11-05");
    expect(Object.keys(entry).sort()).toEqual(["broker", "dates", "reference", "state"]);
  });

  it("records a reply on a given date", async () => {
    const ledgerPath = ledgerWith([sent()]);
    expect((await run(["reply", "broker-a", "2026-11-03"], { ledgerPath, today: "2026-11-05" })).code).toBe(0);
    expect(loadLedger(ledgerPath).entries[0].dates.replied).toBe("2026-11-03");
  });

  it.each([
    ["before the send", "2026-10-01"],
    ["in the future", "2026-12-01"],
    ["not a date", "2026-02-30"],
    ["not a date at all", "yesterday"],
  ])("refuses a date %s and changes nothing", async (_, date) => {
    const ledgerPath = ledgerWith([sent()]);
    const before = readFileSync(ledgerPath, "utf8");
    const { code } = await run(["reply", "broker-a", date], { ledgerPath, today: "2026-11-05" });
    expect(code).toBe(1);
    expect(readFileSync(ledgerPath, "utf8")).toBe(before);
  });

  it("refuses when the request is only drafted", async () => {
    const { code, output } = await run(["reply", "broker-a"], { ledgerPath: ledgerWith([drafted()]) });
    expect(code).toBe(1);
    expect(output).toContain("was not sent");
  });

  it("refuses when there is no request", async () => {
    expect((await run(["reply", "broker-a"])).code).toBe(1);
  });

  it("prints usage without a broker", async () => {
    expect((await run(["reply"])).code).toBe(2);
  });
});

describe("privacy-guard report", () => {
  it("lists an overdue request and exits 1", async () => {
    const { code, output } = await run(["report"], { ledgerPath: ledgerWith([sent()]), today: "2026-11-13" });
    expect(code).toBe(1);
    expect(output).toContain("broker-a: sent 2026-10-12, due 2026-11-12, 1 day overdue");
  });

  it("does not list a request on its due date", async () => {
    const { code, output } = await run(["report"], { ledgerPath: ledgerWith([sent()]), today: "2026-11-12" });
    expect(code).toBe(0);
    expect(output).toBe("nothing is overdue");
  });

  it("counts days in the plural", async () => {
    const { output } = await run(["report"], { ledgerPath: ledgerWith([sent()]), today: "2026-11-15" });
    expect(output).toContain("3 days overdue");
  });

  it("lists a drafted request, not sent, and exits 0", async () => {
    const { code, output } = await run(["report"], { ledgerPath: ledgerWith([drafted()]), today: "2027-01-01" });
    expect({ code, output }).toEqual({ code: 0, output: "broker-a: drafted 2026-10-12, not sent" });
  });

  it("lists overdue and drafted requests together, without saying nothing is overdue", async () => {
    const draftB: LedgerEntry = { ...drafted("2026-11-01"), broker: "broker-b" };
    const { code, output } = await run(["report"], { ledgerPath: ledgerWith([sent(), draftB]), today: "2026-11-13" });
    expect(code).toBe(1);
    expect(output).toBe("broker-a: sent 2026-10-12, due 2026-11-12, 1 day overdue\nbroker-b: drafted 2026-11-01, not sent");
  });

  it("says nothing is overdue when every request is acknowledged or not yet due", async () => {
    const acknowledged: LedgerEntry = { ...sent("2026-09-01", "2026-10-01"), broker: "broker-b", state: "acknowledged" };
    const { code, output } = await run(["report"], { ledgerPath: ledgerWith([acknowledged, sent()]), today: "2026-10-20" });
    expect({ code, output }).toEqual({ code: 0, output: "nothing is overdue" });
  });

  it("says nothing is overdue on an empty ledger", async () => {
    expect(await run(["report"])).toEqual({ code: 0, output: "nothing is overdue" });
  });
});

describe("privacy-guard with an old or unknown command", () => {
  it.each([["due"], ["frobnicate"], []])("prints usage and fails: %s", async (...argv) => {
    const { code, output } = await run(argv);
    expect(code).toBe(2);
    expect(output).toContain("usage: privacy-guard");
  });

  it("prints usage on an unknown flag", async () => {
    expect((await run(["draft", "broker-a", "--force"])).code).toBe(2);
  });
});

describe("guardedSend", () => {
  const request = { playbook: undefined as never, fields: [] };

  it("does not deliver without confirmation", async () => {
    const deliver = vi.fn(noNetwork);
    expect(await guardedSend(request, { confirm: false, deliver })).toEqual({ dryRun: true });
    expect(deliver).not.toHaveBeenCalled();
  });

  it("delivers once when confirmed and passes the outcome through", async () => {
    const outcome: DeliveryOutcome = { kind: "receipt", reference: "BA-482915" };
    const deliver = vi.fn(async () => outcome);
    expect(await guardedSend(request, { confirm: true, deliver })).toEqual({ dryRun: false, outcome });
    expect(deliver).toHaveBeenCalledOnce();
  });
});

describe("the privacy-guard bin", () => {
  it("runs from the repo without a build step", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bin-"));
    const output = execFileSync(process.execPath, [resolve("bin/privacy-guard.js"), "report"], { cwd, encoding: "utf8" });
    expect(output.trim()).toBe("nothing is overdue");
  });
});
