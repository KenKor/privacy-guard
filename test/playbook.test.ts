import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPlaybooks } from "../src/playbook.ts";

function brokersDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "brokers-"));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

describe("loadPlaybooks", () => {
  it("loads every playbook in brokers/", () => {
    const playbooks = loadPlaybooks("brokers");
    expect(playbooks.map((p) => p.name)).toContain("broker-a");
    const brokerA = playbooks.find((p) => p.name === "broker-a")!;
    expect(brokerA.channel).toBe("web-form");
    expect(brokerA.form.selector).toBe("form#opt-out-form");
  });

  it("rejects a playbook missing channel, naming the file and the field", () => {
    const dir = brokersDir({
      "broker-x.yaml": "name: broker-x\ndisplay_name: Broker X\nform:\n  url: http://localhost/\n  selector: form\n  fields: {}\n  submit: button\n",
    });
    expect(() => loadPlaybooks(dir)).toThrow(/broker-x\.yaml: missing required field "channel"/);
  });

  it("rejects an unknown channel", () => {
    const dir = brokersDir({
      "broker-y.yaml": "name: broker-y\ndisplay_name: Broker Y\nchannel: carrier-pigeon\n",
    });
    expect(() => loadPlaybooks(dir)).toThrow(/broker-y\.yaml: channel "carrier-pigeon" is not supported/);
  });

  it("reads broker A's receipt block", () => {
    const brokerA = loadPlaybooks("brokers").find((p) => p.name === "broker-a")!;
    expect(brokerA.receipt).toEqual({ selector: "#thanks", reference_pattern: "BA-[0-9]{6}" });
    expect(brokerA.reply).toEqual({ deadline: "one-month" });
  });
});

describe("loadPlaybooks on a web-form playbook", () => {
  const valid = {
    name: "broker-z",
    display_name: "Broker Z",
    channel: "web-form",
    form: {
      url: "http://localhost/",
      selector: "form",
      fields: { email: "{{ subject.email }}", confirm: true },
      submit: "button",
    },
    receipt: { selector: "#thanks", reference_pattern: "BZ-[0-9]+" },
  };

  function loading(mutate: (playbook: any) => void) {
    const playbook = structuredClone(valid) as any;
    mutate(playbook);
    return () => loadPlaybooks(brokersDir({ "broker-z.yaml": JSON.stringify(playbook) }));
  }

  it("accepts a complete one", () => {
    expect(loading(() => {})()).toHaveLength(1);
  });

  it.each([
    ["form.url", (p: any) => delete p.form.url],
    ["form.fields", (p: any) => delete p.form.fields],
    ["receipt.selector", (p: any) => delete p.receipt.selector],
    ["receipt.reference_pattern", (p: any) => delete p.receipt.reference_pattern],
  ])("rejects one missing %s, naming the file and the field", (field, mutate) => {
    expect(loading(mutate)).toThrow(`broker-z.yaml: missing required field "${field}"`);
  });

  it("rejects one without a receipt block, naming the file and the field", () => {
    expect(loading((p) => delete p.receipt)).toThrow(/broker-z\.yaml: missing required field "receipt" for channel "web-form"/);
  });

  it("rejects a reference pattern that does not compile, naming the file and the field", () => {
    expect(loading((p) => (p.receipt.reference_pattern = "BZ-[0-9"))).toThrow(
      /broker-z\.yaml: field "receipt\.reference_pattern" is not a valid regular expression/,
    );
  });

  it.each([
    ["a list", ["a", "b"]],
    ["a number", 42],
    ["null", null],
  ])("rejects a form field whose value is %s, naming the file and the field", (_kind, value) => {
    expect(loading((p) => (p.form.fields.email = value))).toThrow(
      /broker-z\.yaml: field "form\.fields\.email" must be a string or a boolean/,
    );
  });
});
