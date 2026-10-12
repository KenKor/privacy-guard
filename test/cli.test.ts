import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.ts";
import { saveLedger } from "../src/ledger.ts";
import { guardedSend } from "../src/send.ts";

const tmpLedger = () => join(mkdtempSync(join(tmpdir(), "cli-")), "ledger.json");

async function run(
  argv: string[],
  ledgerPath = tmpLedger(),
  { brokersDir = "brokers", subjectPath = "subject.example.yaml" } = {},
) {
  const lines: string[] = [];
  const env = { ledgerPath, brokersDir, subjectPath, today: "2026-10-12", print: (line: string) => lines.push(line) };
  const code = await main(argv, env);
  return { code, output: lines.join("\n") };
}

describe("privacy-guard due", () => {
  it("says nothing is due on an empty ledger", async () => {
    expect(await run(["due"])).toEqual({ code: 0, output: "nothing is due" });
  });

  it("lists the requests due today", async () => {
    const ledgerPath = tmpLedger();
    saveLedger(ledgerPath, {
      entries: [
        { broker: "broker-a", state: "sent", dates: { sent: "2026-09-12", due: "2026-10-12" } },
        { broker: "broker-b", state: "sent", dates: { sent: "2026-10-01", due: "2026-11-01" } },
      ],
    });
    const { code, output } = await run(["due"], ledgerPath);
    expect(code).toBe(0);
    expect(output).toContain("broker-a");
    expect(output).not.toContain("broker-b");
  });
});

describe("privacy-guard send", () => {
  const withDraft = () => {
    const ledgerPath = tmpLedger();
    saveLedger(ledgerPath, { entries: [{ broker: "broker-a", state: "drafted", dates: { drafted: "2026-10-12" } }] });
    return ledgerPath;
  };

  it("without --confirm sends nothing and says so, even on an empty ledger", async () => {
    const { code, output } = await run(["send"]);
    expect(code).toBe(0);
    expect(output).toMatch(/dry run: nothing was sent/i);
    expect(output).toContain("--confirm");
  });

  it("without --confirm names what it would send", async () => {
    const { code, output } = await run(["send"], withDraft());
    expect(code).toBe(0);
    expect(output).toMatch(/dry run: nothing was sent/i);
    expect(output).toContain("would send to broker-a");
  });

  it("with --confirm still sends nothing: no channel can send yet", async () => {
    const { code, output } = await run(["send", "--confirm"], withDraft());
    expect(code).toBe(1);
    expect(output).toMatch(/not implemented yet.*nothing was sent to broker-a/);
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

describe("privacy-guard with an unknown command", () => {
  it("prints usage and fails", async () => {
    const { code, output } = await run(["frobnicate"]);
    expect(code).toBe(2);
    expect(output).toContain("usage: privacy-guard");
  });
});

describe("guardedSend", () => {
  it("does not deliver without confirmation", async () => {
    const deliver = vi.fn();
    const result = await guardedSend({ broker: "broker-a" }, { confirm: false, deliver });
    expect(result).toEqual({ sent: false, reason: "dry-run" });
    expect(deliver).not.toHaveBeenCalled();
  });

  it("delivers once when confirmed", async () => {
    const deliver = vi.fn();
    const result = await guardedSend({ broker: "broker-a" }, { confirm: true, deliver });
    expect(result).toEqual({ sent: true });
    expect(deliver).toHaveBeenCalledOnce();
  });
});

describe("the privacy-guard bin", () => {
  it("runs from the repo without a build step", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bin-"));
    const output = execFileSync(process.execPath, [resolve("bin/privacy-guard.js"), "due"], { cwd, encoding: "utf8" });
    expect(output.trim()).toBe("nothing is due");
  });
});
