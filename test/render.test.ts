import { describe, expect, it } from "vitest";
import { loadPlaybooks } from "../src/playbook.ts";
import { describeSubmission, renderFields } from "../src/render.ts";
import { loadSubject } from "../src/subject.ts";

const brokerA = loadPlaybooks("brokers").find((p) => p.name === "broker-a")!;
const example = loadSubject("subject.example.yaml");
const exampleValues = Object.values(example);

function errorOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected an error");
}

describe("renderFields", () => {
  it("fills placeholders from the subject, keeps literals, sends true as on", () => {
    expect(renderFields(brokerA.form.fields, example)).toEqual([
      { name: "full_name", value: example.full_name, masked: "[subject.full_name]" },
      { name: "email", value: example.email, masked: "[subject.email]" },
      { name: "phone", value: example.phone, masked: "[subject.phone]" },
      { name: "job_title", value: example.job_title, masked: "[subject.job_title]" },
      { name: "request_type", value: "both" },
      { name: "confirm_identity", value: "on" },
    ]);
  });

  it("renders an absent optional value empty", () => {
    const fields = renderFields({ job_title: "{{ subject.job_title | optional }}" }, { full_name: "A", email: "a@example.com" });
    expect(fields).toEqual([{ name: "job_title", value: "", masked: "(empty)" }]);
  });

  it("fills placeholders inside a longer value", () => {
    const fields = renderFields({ message: "Please remove {{ subject.full_name }} <{{ subject.email }}>." }, example);
    expect(fields).toEqual([
      {
        name: "message",
        value: `Please remove ${example.full_name} <${example.email}>.`,
        masked: "Please remove [subject.full_name] <[subject.email]>.",
      },
    ]);
  });

  it("fails on an unclosed placeholder inside a longer value", () => {
    expect(errorOf(() => renderFields({ message: "Hi {{ subject.full_name" }, example))).toMatch(/^field "message": /);
  });

  it("leaves a false field out", () => {
    expect(renderFields({ newsletter: false, request_type: "both" }, example)).toEqual([{ name: "request_type", value: "both" }]);
  });

  it("fails on an unknown placeholder, naming the field and the placeholder", () => {
    expect(errorOf(() => renderFields({ dob: "{{ subject.birthday }}" }, example))).toBe(
      'field "dob": unknown placeholder "subject.birthday"',
    );
  });

  it("fails on a required placeholder with no value, naming the field", () => {
    const subject = { full_name: "A", email: "a@example.com" };
    expect(errorOf(() => renderFields({ phone: "{{ subject.phone }}" }, subject))).toBe(
      'field "phone": the subject has no "phone"',
    );
  });

  it("fails on a malformed placeholder", () => {
    expect(errorOf(() => renderFields({ email: "{{ subject.email | maybe }}" }, example))).toMatch(/^field "email": /);
  });

  it("puts no subject value in any error", () => {
    const messages = [
      errorOf(() => renderFields({ ...brokerA.form.fields, dob: "{{ subject.birthday }}" }, example)),
      errorOf(() => renderFields({ ...brokerA.form.fields, x: "{{ subject.email | maybe }}" }, example)),
    ];
    for (const message of messages) for (const value of exampleValues) expect(message).not.toContain(value);
  });
});

describe("describeSubmission", () => {
  const fields = renderFields(brokerA.form.fields, example);

  it("prints the address, the form, and every field with subject values masked", () => {
    const output = describeSubmission(brokerA, fields, false).join("\n");
    expect(output).toContain("http://localhost:8080/");
    expect(output).toContain("form#opt-out-form");
    expect(output).toContain("full_name: [subject.full_name]");
    expect(output).toContain("email: [subject.email]");
    expect(output).toContain("request_type: both");
    expect(output).toContain("confirm_identity: on");
    for (const value of exampleValues) expect(output).not.toContain(value);
  });

  it("prints an absent optional value as (empty)", () => {
    const partial = renderFields(brokerA.form.fields, { full_name: "A", email: "a@example.com" });
    expect(describeSubmission(brokerA, partial, false).join("\n")).toContain("phone: (empty)");
  });

  it("prints the actual values with show", () => {
    const output = describeSubmission(brokerA, fields, true).join("\n");
    expect(output).toContain(`full_name: ${example.full_name}`);
    expect(output).toContain(`email: ${example.email}`);
  });

  it("masks placeholders inside a longer value", () => {
    const message = renderFields({ message: "Remove {{ subject.email }} now" }, example);
    const output = describeSubmission(brokerA, message, false).join("\n");
    expect(output).toContain("message: Remove [subject.email] now");
    expect(output).not.toContain(example.email);
  });
});
