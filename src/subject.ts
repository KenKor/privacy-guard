// The subject file: the person the requests are about, in a git-ignored subject.yaml.
// Its values are personal data: they go into a rendered form and nowhere else. Errors name the
// file and the key, never a value, and never echo the file's text.
import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";

export const DEFAULT_SUBJECT_PATH = "subject.yaml";
export const SUBJECT_EXAMPLE_PATH = "subject.example.yaml";

export const SUBJECT_KEYS = ["full_name", "email", "phone", "job_title"] as const;
const REQUIRED_KEYS = ["full_name", "email"] as const;

export type SubjectKey = (typeof SUBJECT_KEYS)[number];
export type Subject = Partial<Record<SubjectKey, string>>;

export class SubjectError extends Error {}

export function isSubjectKey(key: string): key is SubjectKey {
  return (SUBJECT_KEYS as readonly string[]).includes(key);
}

export function loadSubject(path: string = DEFAULT_SUBJECT_PATH): Subject {
  const fail = (message: string): never => {
    throw new SubjectError(`${path}: ${message} (see ${SUBJECT_EXAMPLE_PATH})`);
  };
  if (!existsSync(path)) return fail("not found; create it from the example and fill it in");

  let data: unknown;
  try {
    data = parse(readFileSync(path, "utf8"));
  } catch (error) {
    // The yaml package quotes the offending line in its message; report only where it is.
    const line = (error as { linePos?: { line: number }[] }).linePos?.[0]?.line;
    return fail(line === undefined ? "not valid YAML" : `not valid YAML at line ${line}`);
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return fail("expected a YAML mapping");

  for (const [key, value] of Object.entries(data)) {
    if (!isSubjectKey(key)) {
      fail(`unknown key "${key}" (expected one of: ${SUBJECT_KEYS.join(", ")})`);
    }
    if (typeof value !== "string") fail(`"${key}" must be a quoted string; quote its value`);
  }
  const subject = data as Subject;
  for (const key of REQUIRED_KEYS) {
    if (!subject[key]) fail(`missing required key "${key}"`);
  }
  return subject;
}
