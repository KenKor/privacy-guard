// Field rendering: turns a playbook's form fields and the subject into the submission. The same
// rendered list feeds the printout and the POST body, so what is printed is what is sent.
import type { Playbook } from "./playbook.ts";
import { SUBJECT_KEYS, type Subject } from "./subject.ts";

export interface RenderedField {
  name: string;
  value: string;
  /**
   * Set when the value holds subject data: the value as printed, each subject value shown as
   * `[subject.<key>]`, and `(empty)` when nothing is left. Literal fields have none.
   */
  masked?: string;
}

const PLACEHOLDER = /\{\{(.*?)\}\}/g;
const PLACEHOLDER_BODY = /^\s*subject\.(\w+)\s*(\|\s*optional\s*)?$/;

/**
 * Fills `{{ subject.<key> }}` placeholders, anywhere in a field's value. `true` becomes "on" and
 * `false` is left out, as a browser does.
 */
export function renderFields(fields: Record<string, string | boolean>, subject: Subject): RenderedField[] {
  const rendered: RenderedField[] = [];
  for (const [name, template] of Object.entries(fields)) {
    if (template === false) continue;
    if (template === true) {
      rendered.push({ name, value: "on" });
      continue;
    }
    if (!template.includes("{{")) {
      rendered.push({ name, value: template });
      continue;
    }
    const fail = (message: string): never => {
      throw new Error(`field "${name}": ${message}`);
    };
    let value = "";
    let masked = "";
    let rest = 0;
    for (const match of template.matchAll(PLACEHOLDER)) {
      const literal = template.slice(rest, match.index);
      rest = match.index + match[0].length;
      const body = PLACEHOLDER_BODY.exec(match[1]);
      if (!body) fail(`a placeholder must be "{{ subject.<key> }}", optionally with "| optional"`);
      const [, key, optional] = body!;
      if (!(SUBJECT_KEYS as readonly string[]).includes(key)) fail(`unknown placeholder "subject.${key}"`);
      const filled = subject[key as keyof Subject];
      if (!filled && !optional) fail(`the subject has no "${key}"`);
      value += literal + (filled ?? "");
      masked += literal + (filled ? `[subject.${key}]` : "");
    }
    const tail = template.slice(rest);
    if (tail.includes("{{") || tail.includes("}}")) fail(`a placeholder is not closed with "}}"`);
    rendered.push({ name, value: value + tail, masked: masked + tail || "(empty)" });
  }
  return rendered;
}

/** The submission as printed: subject values masked as `[subject.<key>]` unless `show`. */
export function describeSubmission(playbook: Playbook, fields: RenderedField[], show: boolean): string[] {
  const shown = (field: RenderedField) => {
    if (field.masked === undefined) return field.value;
    if (show) return field.value || "(empty)";
    return field.masked;
  };
  return [
    `to: ${playbook.display_name} (${playbook.name})`,
    `address: ${playbook.form.url}`,
    `form: ${playbook.form.selector}`,
    ...fields.map((field) => `  ${field.name}: ${shown(field)}`),
  ];
}
