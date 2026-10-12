import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../src/cli.ts";
import { type LedgerEntry, saveLedger } from "../src/ledger.ts";
import type { Outcome } from "../src/send.ts";

// Reported by the owner: broker A answered a second request with the reference it gave the first
// one, BA-482915, and never acted on the second. A reused reference looks like a receipt, so send
// records the request as sent and starts a deadline broker A never had. The expected outcome below
// is the owner's report as a test; what send should do instead is not decided yet.
describe("privacy-guard send, broker A reuses an earlier reference", () => {
  // Skipped until the behaviour is decided: hospital issue #34
  // (https://github.com/KenKor/privacy-guard/issues/34).
  it.skip("does not start a new deadline on a reference broker A already gave an earlier request", async () => {
    const ledgerPath = join(mkdtempSync(join(tmpdir(), "reused-")), "ledger.json");
    const earlier: LedgerEntry = {
      broker: "broker-a",
      state: "acknowledged",
      reference: "BA-482915",
      dates: { drafted: "2026-03-02", sent: "2026-03-02", due: "2026-04-02", acknowledged: "2026-03-20" },
    };
    saveLedger(ledgerPath, { entries: [earlier, { broker: "broker-a", state: "drafted", dates: { drafted: "2026-10-12" } }] });
    const receiptPage = '<html><body><p id="thanks">Your reference is <strong id="reference">BA-482915</strong>.</p></body></html>';
    const deliver = async (): Promise<Outcome> => ({ kind: "response", status: 200, body: receiptPage });
    const lines: string[] = [];
    const code = await main(["send", "broker-a", "--confirm"], {
      ledgerPath,
      brokersDir: "brokers",
      subjectPath: "subject.example.yaml",
      today: "2026-10-12",
      deliver,
      print: (line: string) => lines.push(line),
    });

    expect(code).toBe(1);
    const entries: LedgerEntry[] = JSON.parse(readFileSync(ledgerPath, "utf8")).entries;
    expect(entries[1].state).toBe("drafted");
    expect(entries[1].dates.due).toBeUndefined();
  });
});
