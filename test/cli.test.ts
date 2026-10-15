import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.ts";
import { saveLedger } from "../src/ledger.ts";
import { guardedSend } from "../src/send.ts";

const tmpLedger = () => join(mkdtempSync(join(tmpdir(), "cli-")), "ledger.json");

async function run(argv: string[], ledgerPath = tmpLedger(), today = "2026-10-12") {
  const lines: string[] = [];
  const code = await main(argv, { ledgerPath, today, print: (line) => lines.push(line) });
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

describe("privacy-guard report", () => {
  it("says nothing is overdue on an empty ledger", async () => {
    expect(await run(["report"])).toEqual({ code: 0, output: "nothing is overdue" });
  });

  it("is quiet on the due date and flags the day after", async () => {
    const ledgerPath = tmpLedger();
    saveLedger(ledgerPath, {
      entries: [{ broker: "broker-a", state: "sent", dates: { sent: "2026-10-12", due: "2026-11-12" } }],
    });
    const before = readFileSync(ledgerPath, "utf8");
    expect(await run(["report"], ledgerPath, "2026-11-12")).toEqual({ code: 0, output: "nothing is overdue" });
    expect(await run(["report"], ledgerPath, "2026-11-13")).toEqual({
      code: 1,
      output: "broker-a: sent 2026-10-12, due 2026-11-12, 1 day overdue",
    });
    expect(readFileSync(ledgerPath, "utf8")).toBe(before);
  });

  it("warns about a sent request with no due date", async () => {
    const ledgerPath = tmpLedger();
    saveLedger(ledgerPath, { entries: [{ broker: "broker-x", state: "sent", dates: { sent: "2026-09-01" } }] });
    expect(await run(["report"], ledgerPath)).toEqual({
      code: 1,
      output: "broker-x: sent 2026-09-01, no due date recorded",
    });
  });

  it("lists every overdue request in ledger order", async () => {
    const ledgerPath = tmpLedger();
    saveLedger(ledgerPath, {
      entries: [
        { broker: "broker-b", state: "sent", dates: { sent: "2026-10-01", due: "2026-11-01" } },
        { broker: "broker-x", state: "sent", dates: { sent: "2026-09-01" } },
        { broker: "broker-a", state: "sent", dates: { sent: "2026-10-12", due: "2026-11-12" } },
      ],
    });
    expect(await run(["report"], ledgerPath, "2026-11-15")).toEqual({
      code: 1,
      output: [
        "broker-b: sent 2026-10-01, due 2026-11-01, 14 days overdue",
        "broker-x: sent 2026-09-01, no due date recorded",
        "broker-a: sent 2026-10-12, due 2026-11-12, 3 days overdue",
      ].join("\n"),
    });
  });

  it("leaves out a sent date that was not recorded", async () => {
    const ledgerPath = tmpLedger();
    saveLedger(ledgerPath, {
      entries: [
        { broker: "broker-a", state: "sent", dates: { due: "2026-11-12" } },
        { broker: "broker-x", state: "sent", dates: {} },
      ],
    });
    expect(await run(["report"], ledgerPath, "2026-11-13")).toEqual({
      code: 1,
      output: "broker-a: sent, due 2026-11-12, 1 day overdue\nbroker-x: sent, no due date recorded",
    });
  });

  it("never lists drafted or acknowledged requests", async () => {
    const ledgerPath = tmpLedger();
    saveLedger(ledgerPath, {
      entries: [
        { broker: "broker-a", state: "drafted", dates: { drafted: "2026-09-01", due: "2026-10-01" } },
        { broker: "broker-b", state: "acknowledged", dates: { sent: "2026-09-01", due: "2026-10-01" } },
      ],
    });
    expect(await run(["report"], ledgerPath)).toEqual({ code: 0, output: "nothing is overdue" });
  });

  it("stops on a ledger that still stores overdue", async () => {
    const ledgerPath = tmpLedger();
    writeFileSync(
      ledgerPath,
      JSON.stringify({ entries: [{ broker: "broker-a", state: "overdue", dates: { sent: "2026-08-01", due: "2026-09-01" } }] }),
    );
    const lines: string[] = [];
    await expect(main(["report"], { ledgerPath, today: "2026-10-12", print: (line) => lines.push(line) })).rejects.toThrow(
      `${ledgerPath}: entry 0: state "overdue" is not one of drafted, sent, acknowledged, escalated`,
    );
    expect(lines).toEqual([]);
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
