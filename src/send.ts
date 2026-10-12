// The send guard. Every send is a dry run unless the caller confirmed it (`--confirm` on the CLI).
// Channels plug in as `deliver`, which returns the outcome; `httpDeliver` submits a web form.

export interface SendRequest {
  broker: string;
  /** The form's address. */
  url: string;
  /** The rendered fields, in the order they are posted. */
  fields: { name: string; value: string }[];
}

/**
 * What came back: a status and a body, or why there is none. `code` is the failure's cause code when
 * there is one; only `isPreConnection` codes mean nothing reached the broker.
 */
export type Outcome =
  | { kind: "response"; status: number; body: string }
  | { kind: "failed"; reason: "timeout" }
  | { kind: "failed"; reason: "too-large" }
  | { kind: "failed"; reason: "error"; code?: string };

export type Deliver = (request: SendRequest) => Promise<Outcome>;

export type SendResult = { sent: true; outcome: Outcome } | { sent: false; reason: "dry-run" };

export async function guardedSend(
  request: SendRequest,
  options: { confirm: boolean; deliver: Deliver },
): Promise<SendResult> {
  if (!options.confirm) return { sent: false, reason: "dry-run" };
  return { sent: true, outcome: await options.deliver(request) };
}

export const TIMEOUT_MS = 10_000;
export const MAX_RESPONSE_BYTES = 1024 * 1024;

/**
 * One form-encoded POST with Node's `fetch`. No redirect is followed: `fetch` would post the fields
 * again on a 307 or 308, possibly to another origin. The timeout covers the whole exchange, reading
 * the body included, and reading stops at the cap. Never throws.
 */
export async function httpDeliver(request: SendRequest, { timeoutMs = TIMEOUT_MS } = {}): Promise<Outcome> {
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetch(request.url, {
      method: "POST",
      body: new URLSearchParams(request.fields.map(({ name, value }) => [name, value])),
      redirect: "manual",
      signal,
    });
    const body = await readCapped(response);
    if (body === undefined) return { kind: "failed", reason: "too-large" };
    return { kind: "response", status: response.status, body };
  } catch (error) {
    if (signal.aborted) return { kind: "failed", reason: "timeout" };
    return failureOf(error);
  }
}

async function readCapped(response: Response): Promise<string | undefined> {
  if (response.body === null) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    // Leaving the loop early cancels the stream.
    if (size > MAX_RESPONSE_BYTES) return undefined;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const PRE_CONNECTION_CODES: readonly string[] = ["ENOTFOUND", "ECONNREFUSED"];
const isPreConnectionCode = (code: string | undefined) => code !== undefined && PRE_CONNECTION_CODES.includes(code);

/** True only when the failure is positively one that happened before a connection was made. */
export function isPreConnection(outcome: Outcome): outcome is { kind: "failed"; reason: "error"; code: string } {
  return outcome.kind === "failed" && outcome.reason === "error" && isPreConnectionCode(outcome.code);
}

/**
 * A thrown failure as an outcome. `fetch` reports every failure as `TypeError: fetch failed`; only the
 * cause's code tells them apart. An `AggregateError` (several addresses tried) is pre-connection only
 * when every error in it is, so it otherwise takes a code that is not.
 */
export function failureOf(error: unknown): Outcome {
  const cause = (error as { cause?: unknown } | undefined)?.cause ?? error;
  if (cause instanceof AggregateError) {
    const codes = cause.errors.map(codeOf);
    const preConnection = codes.length > 0 && codes.every(isPreConnectionCode);
    const code = preConnection ? codes[0] : codes.find((other) => other !== undefined && !isPreConnectionCode(other));
    return { kind: "failed", reason: "error", code };
  }
  return { kind: "failed", reason: "error", code: codeOf(cause) };
}

function codeOf(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | undefined)?.code;
  return typeof code === "string" ? code : undefined;
}
