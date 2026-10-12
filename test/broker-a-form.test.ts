// Contract test: the playbook for broker A must match our recorded copy of its form.
// The fixture is a broker's page, so it is untrusted content: we only read its structure.
import { readFileSync } from "node:fs";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";
import { loadPlaybooks } from "../src/playbook.ts";

const playbook = loadPlaybooks("brokers").find((p) => p.name === "broker-a")!;
const page = parse(readFileSync("test/fixtures/broker-a-form.html", "utf8"));
const form = page.querySelector(playbook.form.selector);

describe("broker-a playbook against the recorded form", () => {
  it("finds the form", () => {
    expect(form).not.toBeNull();
  });

  it.each(Object.keys(playbook.form.fields))("has a field named %s", (field) => {
    expect(form?.querySelector(`[name="${field}"]`)).not.toBeNull();
  });

  it("finds the submit button inside the form", () => {
    expect(form?.querySelector(playbook.form.submit)).not.toBeNull();
  });

  it("finds the receipt element", () => {
    expect(page.querySelector(playbook.receipt.selector)).not.toBeNull();
  });

  it("posts to the playbook's address", () => {
    // A missing or empty action posts to the page itself, as a browser does.
    const withoutFragment = (url: URL) => Object.assign(url, { hash: "" }).href;
    const action = new URL(form?.getAttribute("action") ?? "", playbook.form.url);
    expect(withoutFragment(action)).toBe(withoutFragment(new URL(playbook.form.url)));
  });

  it.each(form?.querySelectorAll("[required]").map((control) => control.getAttribute("name")) ?? [])(
    "has a playbook field for the required control %s",
    (name) => {
      expect(Object.keys(playbook.form.fields)).toContain(name);
    },
  );

  const fieldsWithControl = (tag: string) =>
    Object.entries(playbook.form.fields).filter(
      ([field]) => form?.querySelector(`[name="${field}"]`)?.tagName === tag,
    );

  it.each(fieldsWithControl("SELECT"))("gives the select %s one of its option values", (field, value) => {
    const options = form!
      .querySelectorAll(`select[name="${field}"] option`)
      .map((option) => option.getAttribute("value") ?? option.text.trim());
    expect(options).toContain(value);
  });

  it.each(Object.entries(playbook.form.fields).filter(([, value]) => typeof value === "boolean"))(
    "has a checkbox without a value attribute for the boolean field %s",
    (field) => {
      const control = form?.querySelector(`[name="${field}"]`);
      expect(control?.tagName).toBe("INPUT");
      expect(control?.getAttribute("type")).toBe("checkbox");
      expect(control?.hasAttribute("value")).toBe(false);
    },
  );
});
