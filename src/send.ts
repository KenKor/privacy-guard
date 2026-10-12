// The send guard. Every send is a dry run unless the caller confirmed it (`--confirm` on the CLI).
// Channels plug in as `deliver`; none is wired up yet, so the CLI's deliver refuses.

export interface SendRequest {
  broker: string;
}

export type Deliver = (request: SendRequest) => Promise<void> | void;

export type SendResult = { sent: true } | { sent: false; reason: "dry-run" };

export async function guardedSend(
  request: SendRequest,
  options: { confirm: boolean; deliver: Deliver },
): Promise<SendResult> {
  if (!options.confirm) return { sent: false, reason: "dry-run" };
  await options.deliver(request);
  return { sent: true };
}
