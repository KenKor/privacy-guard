// Field rendering: turns a playbook's form fields and the subject into the submission. The same
// rendered list feeds the printout and the POST body, so what is printed is what is sent.
import type { Playbook } from "./playbook.ts";
import { SUBJECT_KEYS, type Subject } from "./subject.ts";

export interface RenderedField {
  name: string;
  value: string;
  /** Set when the value came from the subject, e.g. "subject.email"; such values are masked in output. */
  placeholder?: string;
}

const PLACEHOLDER = /^\{\{\s*subject\.(\w+)\s*(\|\s*optional\s*)?\}\}$/;

/** Fills `{{ subject.<key> }}` placeholders. `true` becomes "on" and `false` is left out, as a browser does. */
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
    const match = PLACEHOLDER.exec(template);
    if (!match) throw new Error(`field "${name}": a placeholder must be "{{ subject.<key> }}", optionally with "| optional"`);
    const [, key, optional] = match;
    const placeholder = `subject.${key}`;
    if (!(SUBJECT_KEYS as readonly string[]).includes(key)) {
      throw new Error(`field "${name}": unknown placeholder "${placeholder}"`);
    }
    const value = subject[key as keyof Subject];
    if (!value && !optional) throw new Error(`field "${name}": the subject has no "${key}"`);
    rendered.push({ name, value: value ?? "", placeholder });
  }
  return rendered;
}

/** The submission as printed: subject values masked as `[subject.<key>]` unless `show`. */
export function describeSubmission(playbook: Playbook, fields: RenderedField[], show: boolean): string[] {
  const shown = (field: RenderedField) => {
    if (field.placeholder === undefined) return field.value;
    if (field.value === "") return "(empty)";
    return show ? field.value : `[${field.placeholder}]`;
  };
  return [
    `to: ${playbook.display_name} (${playbook.name})`,
    `address: ${playbook.form.url}`,
    `form: ${playbook.form.selector}`,
    ...fields.map((field) => `  ${field.name}: ${shown(field)}`),
  ];
}
