// The web-form channel: posts the rendered fields as a browser would, without running any script.
// The broker's answer is untrusted content: only the text at `receipt.selector` is read, and only
// the part matching `receipt.reference_pattern` leaves this module.
import { parse } from "node-html-parser";
import type { DeliveryOutcome, SendRequest } from "./send.ts";

const TIMEOUT_MS = 10_000;

export async function submitWebForm(
  { playbook, fields }: SendRequest,
  { timeoutMs = TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<DeliveryOutcome> {
  const timedOut: DeliveryOutcome = { kind: "unclear", reason: `no answer within ${timeoutMs / 1000} seconds` };
  let response: Response;
  try {
    response = await fetch(playbook.form.url, {
      method: "POST",
      body: new URLSearchParams(fields.map(({ name, value }) => [name, value])),
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isTimeout(error)) return timedOut;
    return { kind: "not-sent", reason: `could not reach the broker (${networkCode(error)})` };
  }

  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    return { kind: "not-sent", reason: `the broker answered ${response.status}, a redirect, which is not followed` };
  }
  if (response.status < 200 || response.status >= 300) {
    await response.body?.cancel();
    return { kind: "not-sent", reason: `the broker answered ${response.status}` };
  }

  let html: string;
  try {
    html = await response.text();
  } catch (error) {
    if (isTimeout(error)) return timedOut;
    return { kind: "unclear", reason: "the answer could not be read" };
  }
  const text = parse(html).querySelector(playbook.receipt.selector)?.text ?? "";
  const match = new RegExp(playbook.receipt.reference_pattern).exec(text);
  if (!match) return { kind: "unclear", reason: "no receipt in the answer" };
  return { kind: "receipt", reference: match[0] };
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

function networkCode(error: unknown): string {
  const cause = (error as { cause?: { code?: unknown } }).cause;
  return typeof cause?.code === "string" ? cause.code : "network error";
}
