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

  it("finds the acknowledgement element", () => {
    expect(page.querySelector(playbook.reply!.acknowledged_when!.selector!)).not.toBeNull();
  });
});
