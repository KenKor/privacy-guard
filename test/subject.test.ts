import { execFileSync } from "node:child_process";
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
  it("loads the committed example subject", () => {
    const subject = loadSubject("subject.example.yaml");
    expect(Object.keys(subject).sort()).toEqual(["email", "full_name", "job_title", "phone"]);
  });

  it("loads a subject without the optional keys", () => {
    expect(loadSubject(subjectFile('full_name: "Ann Example"\nemail: "ann@example.com"\n'))).toEqual({
      full_name: "Ann Example",
      email: "ann@example.com",
    });
  });

  it("refuses a missing file, naming it and pointing at the example", () => {
    const path = join(mkdtempSync(join(tmpdir(), "subject-")), "subject.yaml");
    expect(() => loadSubject(path)).toThrow(`${path} does not exist`);
    expect(() => loadSubject(path)).toThrow("subject.example.yaml");
  });

  it("refuses a missing required key, naming it", () => {
    const path = subjectFile('full_name: "Ann Example"\n');
    expect(() => loadSubject(path)).toThrow(`${path}: missing required key "email"`);
  });

  it("refuses an unquoted phone number, naming the key without printing the value", () => {
    const path = subjectFile('full_name: "Ann Example"\nemail: "ann@example.com"\nphone: 0612345678\n');
    let message = "";
    try {
      loadSubject(path);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain(`"phone"`);
    expect(message).toMatch(/quote/);
    expect(message).not.toMatch(/612345678/);
  });

  it("refuses YAML that does not parse, without printing the file's text", () => {
    const path = subjectFile('full_name: "Ann Example\nemail: ann@example.com\n');
    let message = "";
    try {
      loadSubject(path);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain(`${path}: not valid YAML`);
    expect(message).not.toMatch(/Ann|ann@/);
  });

  it("is ignored by git", () => {
    expect(execFileSync("git", ["check-ignore", "subject.yaml"], { encoding: "utf8" }).trim()).toBe("subject.yaml");
  });
});
