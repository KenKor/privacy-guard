// A playbook says how to ask one broker to stop: which channel, which form, which fields.
// Playbooks are data: broker-specific behaviour lives in brokers/<name>.yaml, not here.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export const CHANNELS = ["web-form"] as const;
export type Channel = (typeof CHANNELS)[number];

export interface WebForm {
  url: string;
  selector: string;
  /** Form field name to value; values may be templates such as "{{ subject.email }}". */
  fields: Record<string, string | boolean>;
  submit: string;
}

export interface Playbook {
  name: string;
  display_name: string;
  jurisdiction?: string;
  legal_basis?: string[];
  channel: Channel;
  form: WebForm;
  reply?: {
    deadline?: string;
    acknowledged_when?: { selector?: string; reference_pattern?: string };
  };
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
  for (const field of ["url", "selector", "submit"]) {
    if (typeof form[field] !== "string") fail(`missing required field "form.${field}"`);
  }
  if (!isRecord(form.fields)) fail(`missing required field "form.fields"`);

  return data as unknown as Playbook;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
