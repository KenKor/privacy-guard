// The subject file: the details of the person the requests are about. It is personal data, so it
// lives in a git-ignored subject.yaml, and no error here ever contains one of its values.
import { existsSync, readFileSync } from "node:fs";
import { parse, YAMLParseError } from "yaml";

export const DEFAULT_SUBJECT_PATH = "subject.yaml";
export const SUBJECT_KEYS = ["full_name", "email", "phone", "job_title"] as const;
const REQUIRED_KEYS = ["full_name", "email"];

export type Subject = Partial<Record<(typeof SUBJECT_KEYS)[number], string>>;

export function loadSubject(path: string = DEFAULT_SUBJECT_PATH): Subject {
  if (!existsSync(path)) {
    throw new Error(`${path} does not exist: copy subject.example.yaml to it and fill in the subject's details`);
  }
  let data: unknown;
  try {
    data = parse(readFileSync(path, "utf8"));
  } catch (error) {
    // The parser's own message quotes the offending line, which may hold a value.
    const line = error instanceof YAMLParseError && error.linePos ? ` at line ${error.linePos[0].line}` : "";
    throw new Error(`${path}: not valid YAML${line}`);
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) throw new Error(`${path}: expected a YAML mapping`);

  const subject = data as Record<string, unknown>;
  for (const [key, value] of Object.entries(subject)) {
    if (typeof value !== "string") throw new Error(`${path}: "${key}" must be a string; put its value in quotes`);
  }
  for (const key of REQUIRED_KEYS) {
    if (!subject[key]) throw new Error(`${path}: missing required key "${key}"`);
  }
  return subject as Subject;
}
