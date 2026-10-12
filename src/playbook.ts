// A playbook says how to ask one broker to stop: which channel, which form, which fields.
// Playbooks are data: broker-specific behaviour lives in brokers/<name>.yaml, not here.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export const DEFAULT_BROKERS_DIR = "brokers";

export const CHANNELS = ["web-form"] as const;
export type Channel = (typeof CHANNELS)[number];

export interface WebForm {
  url: string;
  selector: string;
  /** Form field name to value; values may be templates such as "{{ subject.email }}". */
  fields: Record<string, string | boolean>;
  submit: string;
}

export interface Receipt {
  /** The element on the broker's page that holds the reference. */
  selector: string;
  /** A regular expression that matches the reference, such as "BA-[0-9]{6}". */
  reference_pattern: string;
}

export interface Playbook {
  name: string;
  display_name: string;
  jurisdiction?: string;
  legal_basis?: string[];
  channel: Channel;
  form: WebForm;
  /** How the broker's receipt is found after a submission. A receipt is not a reply. */
  receipt: Receipt;
  reply?: { deadline?: string };
  cadence?: string;
  dry_run?: boolean;
}

export class PlaybookError extends Error {}

/** Loads and validates every playbook (*.yaml, *.yml) in `dir`. Throws on the first invalid one. */
export function loadPlaybooks(dir: string): Playbook[] {
  return readdirSync(dir)
    .filter((file) => /\.ya?ml$/.test(file))
    .sort()
    .map((file) => parsePlaybook(file, readFileSync(join(dir, file), "utf8")));
}

export function parsePlaybook(file: string, text: string): Playbook {
  const fail = (message: string): never => {
    throw new PlaybookError(`${file}: ${message}`);
  };
  const data: unknown = parse(text);
  if (!isRecord(data)) return fail("expected a YAML mapping");

  for (const field of ["name", "display_name", "channel"]) {
    if (data[field] === undefined) fail(`missing required field "${field}"`);
    if (typeof data[field] !== "string") fail(`field "${field}" must be a string`);
  }
  if (!(CHANNELS as readonly unknown[]).includes(data.channel)) {
    fail(`channel "${data.channel}" is not supported (expected one of: ${CHANNELS.join(", ")})`);
  }

  const form = data.form;
  if (!isRecord(form)) return fail(`missing required field "form" for channel "${data.channel}"`);
  requireStrings(form, "form", ["url", "selector", "submit"], fail);
  if (!isRecord(form.fields)) return fail(`missing required field "form.fields"`);
  for (const [name, value] of Object.entries(form.fields)) {
    if (typeof value !== "string" && typeof value !== "boolean") {
      fail(`field "form.fields.${name}" must be a string or a boolean`);
    }
  }

  const receipt = data.receipt;
  if (!isRecord(receipt)) return fail(`missing required field "receipt" for channel "${data.channel}"`);
  requireStrings(receipt, "receipt", ["selector", "reference_pattern"], fail);
  try {
    new RegExp(receipt.reference_pattern as string);
  } catch {
    fail(`field "receipt.reference_pattern" is not a valid regular expression`);
  }

  return data as unknown as Playbook;
}

function requireStrings(
  block: Record<string, unknown>,
  prefix: string,
  fields: string[],
  fail: (message: string) => never,
): void {
  for (const field of fields) {
    if (typeof block[field] !== "string") fail(`missing required field "${prefix}.${field}"`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
