// Reads a broker's receipt reference from its answer to a submitted form.
// The answer is untrusted content: it is parsed without running script, and nothing but the
// matched reference leaves this module. Which element and pattern to look for is playbook data.
import { parse } from "node-html-parser";
import type { Playbook } from "./playbook.ts";

export type ReceiptReading = { reference: string } | { missing: "form-returned" | "no-reference" };

export function readReceipt(body: string, playbook: Pick<Playbook, "form" | "receipt">): ReceiptReading {
  const page = parse(body);
  // The form coming back is no thank-you page, whatever the pattern finds in it (broker A's form
  // page carries a placeholder reference).
  if (page.querySelector(playbook.form.selector) !== null) return { missing: "form-returned" };
  const text = page.querySelector(playbook.receipt.selector)?.text ?? "";
  const reference = new RegExp(playbook.receipt.reference_pattern).exec(text)?.[0];
  return reference === undefined ? { missing: "no-reference" } : { reference };
}
