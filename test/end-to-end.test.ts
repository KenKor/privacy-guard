// One request's whole life against the local broker A stand-in: draft, dry run, confirmed send,
// report on the due date and the day after, reply. The CLI runs in-process with the real
// form submission; the playbook is broker A's, pointed at the stand-in's free port.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { main } from "../src/cli.ts";
import { loadLedger } from "../src/ledger.ts";
import { loadSubject } from "../src/subject.ts";
import { submitWebForm } from "../src/web-form.ts";
import { type RunningSite, startSite } from "./helpers/site.ts";

let site: RunningSite;
let brokersDir: string;
const ledgerPath = join(mkdtempSync(join(tmpdir(), "e2e-")), "ledger.json");

beforeAll(async () => {
  site = await startSite();
  brokersDir = mkdtempSync(join(tmpdir(), "e2e-brokers-"));
  const playbook = readFileSync("brokers/broker-a.yaml", "utf8").replace("http://localhost:8080/", site.url);
  writeFileSync(join(brokersDir, "broker-a.yaml"), playbook);
});
afterAll(() => site.stop());

async function run(today: string, ...argv: string[]) {
  const lines: string[] = [];
  const code = await main(argv, {
    ledgerPath,
    brokersDir,
    subjectPath: "subject.example.yaml",
    today,
    deliver: submitWebForm,
    print: (line) => lines.push(line),
  });
  return { code, output: lines.join("\n") };
}

it("drafts, dry-runs, sends, reports and records the reply", async () => {
  expect((await run("2026-10-12", "draft", "broker-a")).code).toBe(0);

  const dry = await run("2026-10-12", "send", "broker-a");
  expect(dry.code).toBe(0);
  expect(dry.output).toMatch(/dry run: nothing was sent/);
  expect(site.output()).not.toMatch(/POST/);

  const sent = await run("2026-10-12", "send", "broker-a", "--confirm");
  expect(sent.code).toBe(0);
  const [entry] = loadLedger(ledgerPath).entries;
  expect(entry).toMatchObject({ state: "sent", dates: { sent: "2026-10-12", due: "2026-11-12" } });
  expect(entry.reference).toMatch(/^BA-\d{6}$/);
  expect(entry.reference).not.toBe("BA-000000");
  expect(sent.output).toContain(entry.reference);

  expect(await run("2026-11-12", "report")).toEqual({ code: 0, output: "nothing is overdue" });
  expect(await run("2026-11-13", "report")).toEqual({
    code: 1,
    output: "broker-a: sent 2026-10-12, due 2026-11-12, 1 day overdue",
  });

  expect((await run("2026-11-14", "reply", "broker-a")).code).toBe(0);
  expect(await run("2026-11-15", "report")).toEqual({ code: 0, output: "nothing is overdue" });

  const ledger = readFileSync(ledgerPath, "utf8");
  for (const value of Object.values(loadSubject("subject.example.yaml"))) expect(ledger).not.toContain(value);
});
