import { describe, expect, it } from "vitest";
import { renderFields } from "../src/render.ts";

const subject = { full_name: "Alex Example", email: "alex.example@example.org" };

describe("renderFields", () => {
  it("fills a placeholder from the subject and remembers where the value came from", () => {
    expect(renderFields({ email: "{{ subject.email }}" }, subject)).toEqual([
      { name: "email", value: "alex.example@example.org", placeholder: "subject.email" },
    ]);
  });

  it("sends an absent optional value empty", () => {
    expect(renderFields({ phone: "{{ subject.phone | optional }}" }, subject)).toEqual([
      { name: "phone", value: "", placeholder: "subject.phone" },
    ]);
  });

  it("sends a literal as it is, true as on, and leaves a false field out", () => {
    expect(renderFields({ request_type: "both", confirm: true, newsletter: false }, subject)).toEqual([
      { name: "request_type", value: "both" },
      { name: "confirm", value: "on" },
    ]);
  });

  it("fails on a required placeholder without a value, naming the field and the placeholder", () => {
    expect(() => renderFields({ tel: "{{ subject.phone }}" }, subject)).toThrow(/"tel".*subject\.phone/);
  });

  it("fails on an unknown placeholder, naming the field and the placeholder", () => {
    expect(() => renderFields({ city: "{{ subject.city }}" }, subject)).toThrow(/"city".*subject\.city/);
    expect(() => renderFields({ city: "{{ subject.city | optional }}" }, subject)).toThrow(/"city".*subject\.city/);
  });

  it("fails on a placeholder it cannot read, rather than sending it as text", () => {
    expect(() => renderFields({ name: "Dear {{ subject.full_name }}" }, subject)).toThrow(/"name".*placeholder/);
    expect(() => renderFields({ name: "{{ full_name }}" }, subject)).toThrow(/"name".*placeholder/);
  });

  it("never puts a subject value in an error", () => {
    expect(() => renderFields({ a: "{{ subject.full_name }}", b: "{{ subject.city }}" }, subject)).not.toThrow(/Alex/);
  });
});
