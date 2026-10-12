import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.ts";
import { saveLedger } from "../src/ledger.ts";
import { guardedSend } from "../src/send.ts";

const tmpLedger = () => join(mkdtempSync(join(tmpdir(), "cli-")), "ledger.json");

async function run(argv: string[], ledgerPath = tmpLedger()) {
  const lines: string[] = [];
  const code = await main(argv, { ledgerPath, today: "2026-10-12", print: (line) => lines.push(line) });
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
  it("says it is not implemented yet", async () => {
    expect((await run(["draft"])).output).toMatch(/not implemented yet/);
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
