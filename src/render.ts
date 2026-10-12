// Renders a web form's fields from the playbook and the subject, and prints the submission.
// Generic over every web-form playbook: a field is a literal, a boolean, or one whole
// "{{ subject.<key> }}" placeholder, optionally "| optional". No broker's field is named here.
import type { WebForm } from "./playbook.ts";
import { isSubjectKey, SUBJECT_KEYS, type Subject } from "./subject.ts";

export interface RenderedField {
  name: string;
  value: string;
  /** "subject.<key>" when the value came from the subject file; such a value is masked when printed. */
  placeholder?: string;
}

export class RenderError extends Error {}

const PLACEHOLDER = /^\{\{\s*subject\.(\w+)\s*(\|\s*optional\s*)?\}\}$/;

/** The fields as a browser would send them: `true` as "on", `false` left out. Errors carry no subject value. */
export function renderFields(fields: Record<string, string | boolean>, subject: Subject): RenderedField[] {
  const rendered: RenderedField[] = [];
  for (const [name, template] of Object.entries(fields)) {
    if (template === false) continue;
    if (template === true) {
      rendered.push({ name, value: "on" });
      continue;
    }
    const match = PLACEHOLDER.exec(template);
    if (!match) {
      if (template.includes("{{")) {
        throw new RenderError(`field "${name}": cannot read the placeholder in "${template}"; expected "{{ subject.<key> }}"`);
      }
      rendered.push({ name, value: template });
      continue;
    }
    const [, key, optional] = match;
    const placeholder = `subject.${key}`;
    if (!isSubjectKey(key)) {
      throw new RenderError(`field "${name}": unknown placeholder "${placeholder}" (expected one of: ${SUBJECT_KEYS.join(", ")})`);
    }
    const value = subject[key] ?? "";
    if (value === "" && !optional) {
      throw new RenderError(`field "${name}": placeholder "${placeholder}" has no value in the subject file`);
    }
    rendered.push({ name, value, placeholder });
  }
  return rendered;
}

/** The submission as printed: address, form selector, then each field, subject values masked unless `show`. */
export function formatSubmission(form: WebForm, fields: RenderedField[], show: boolean): string[] {
  const width = Math.max(0, ...fields.map((field) => field.name.length)) + 2;
  const shown = (field: RenderedField) => {
    if (field.placeholder === undefined || show) return field.value;
    return field.value === "" ? "(empty)" : `[${field.placeholder}]`;
  };
  return [`POST ${form.url}  (${form.selector})`, ...fields.map((field) => `  ${field.name.padEnd(width)}${shown(field)}`)];
}
