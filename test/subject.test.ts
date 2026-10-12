import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSubject } from "../src/subject.ts";

function subjectFile(text: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "subject-")), "subject.yaml");
  writeFileSync(path, text);
  return path;
}

describe("loadSubject", () => {
  it("reads the example subject", () => {
    expect(loadSubject("subject.example.yaml")).toEqual({
      full_name: "Alex Example",
      email: "alex.example@example.org",
      phone: "+00 000 000 000",
      job_title: "Test Engineer",
    });
  });

  it("accepts a subject without the optional phone and job title", () => {
    const path = subjectFile('full_name: "Alex Example"\nemail: "alex.example@example.org"\n');
    expect(loadSubject(path)).toEqual({ full_name: "Alex Example", email: "alex.example@example.org" });
  });

  it("refuses a subject without email, naming the file and the key and no value", () => {
    const path = subjectFile('full_name: "Alex Example"\n');
    expect(() => loadSubject(path)).toThrow(/subject\.yaml.*"email".*subject\.example\.yaml/);
    expect(() => loadSubject(path)).not.toThrow(/Alex/);
  });

  it("refuses an unquoted number, naming the key and the file and saying to quote it", () => {
    const path = subjectFile('full_name: "Alex Example"\nemail: "alex.example@example.org"\nphone: 0612345678\n');
    expect(() => loadSubject(path)).toThrow(/subject\.yaml.*"phone".*quote/);
    expect(() => loadSubject(path)).not.toThrow(/612345678|Alex|example\.org/);
  });

  it("refuses a missing file, naming it and pointing at the example", () => {
    const path = join(mkdtempSync(join(tmpdir(), "subject-")), "subject.yaml");
    expect(() => loadSubject(path)).toThrow(/subject\.yaml.*subject\.example\.yaml/);
  });

  it("refuses a key it does not know, so a typo is not sent empty", () => {
    const path = subjectFile('full_name: "Alex Example"\nemail: "alex.example@example.org"\nphnoe: "+00 000"\n');
    expect(() => loadSubject(path)).toThrow(/subject\.yaml.*"phnoe"/);
    expect(() => loadSubject(path)).not.toThrow(/\+00/);
  });

  it("does not echo the file's text when it is not valid YAML", () => {
    const path = subjectFile('full_name: "Alex Example\nemail: alex.example@example.org: x\n');
    expect(() => loadSubject(path)).toThrow(/subject\.yaml/);
    expect(() => loadSubject(path)).not.toThrow(/Alex|example\.org/);
  });
});
