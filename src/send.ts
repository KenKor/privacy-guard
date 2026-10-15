// The send guard. Every send is a dry run unless the caller confirmed it (`--confirm` on the CLI).
// Channels plug in as `deliver`, and `guardedSend` is the only path to it.
import type { Playbook } from "./playbook.ts";
import type { RenderedField } from "./render.ts";

export interface SendRequest {
  playbook: Playbook;
  fields: RenderedField[];
}

/**
 * What came back from the broker. Only a `receipt` makes a request sent.
 * `not-sent`: the broker refused it, or it never reached the broker.
 * `unclear`: it may have arrived, but no receipt came back.
 */
export type DeliveryOutcome =
  | { kind: "receipt"; reference: string }
  | { kind: "not-sent"; reason: string }
  | { kind: "unclear"; reason: string };

export type Deliver = (request: SendRequest) => Promise<DeliveryOutcome>;

export type SendResult = { dryRun: true } | { dryRun: false; outcome: DeliveryOutcome };

export async function guardedSend(
  request: SendRequest,
  options: { confirm: boolean; deliver: Deliver },
): Promise<SendResult> {
  if (!options.confirm) return { dryRun: true };
  return { dryRun: false, outcome: await options.deliver(request) };
}
