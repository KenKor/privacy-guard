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

const FORM = "form:\n  url: http://localhost/\n  selector: form\n  fields:\n    email: x\n  submit: button\n";
const RECEIPT = 'receipt:\n  selector: "#thanks"\n  reference_pattern: "BX-[0-9]{6}"\n';
const webForm = (rest: string) => `name: broker-x\ndisplay_name: Broker X\nchannel: web-form\n${rest}`;

describe("loadPlaybooks", () => {
  it("loads every playbook in brokers/", () => {
    const playbooks = loadPlaybooks("brokers");
    expect(playbooks.map((p) => p.name)).toContain("broker-a");
    const brokerA = playbooks.find((p) => p.name === "broker-a")!;
    expect(brokerA.channel).toBe("web-form");
    expect(brokerA.form.selector).toBe("form#opt-out-form");
    expect(brokerA.receipt).toEqual({ selector: "#thanks", reference_pattern: "BA-[0-9]{6}" });
  });

  it("loads a web-form playbook with a receipt", () => {
    const [playbook] = loadPlaybooks(brokersDir({ "broker-x.yaml": webForm(FORM + RECEIPT) }));
    expect(playbook.receipt.reference_pattern).toBe("BX-[0-9]{6}");
  });

  it("rejects a playbook missing channel, naming the file and the field", () => {
    const dir = brokersDir({ "broker-x.yaml": "name: broker-x\ndisplay_name: Broker X\n" + FORM + RECEIPT });
    expect(() => loadPlaybooks(dir)).toThrow(/broker-x\.yaml: missing required field "channel"/);
  });

  it("rejects an unknown channel", () => {
    const dir = brokersDir({
      "broker-y.yaml": "name: broker-y\ndisplay_name: Broker Y\nchannel: carrier-pigeon\n",
    });
    expect(() => loadPlaybooks(dir)).toThrow(/broker-y\.yaml: channel "carrier-pigeon" is not supported/);
  });

  it("rejects a web-form playbook without a receipt", () => {
    const dir = brokersDir({ "broker-x.yaml": webForm(FORM) });
    expect(() => loadPlaybooks(dir)).toThrow(/broker-x\.yaml: missing required field "receipt"/);
  });

  it("rejects a receipt without a reference_pattern, naming the file and the field", () => {
    const dir = brokersDir({ "broker-x.yaml": webForm(FORM + 'receipt:\n  selector: "#thanks"\n') });
    expect(() => loadPlaybooks(dir)).toThrow(/broker-x\.yaml: missing required field "receipt\.reference_pattern"/);
  });

  it("rejects a receipt selector that is not a string", () => {
    const dir = brokersDir({ "broker-x.yaml": webForm(FORM + "receipt:\n  selector: 3\n  reference_pattern: x\n") });
    expect(() => loadPlaybooks(dir)).toThrow(/broker-x\.yaml: missing required field "receipt\.selector"/);
  });

  it("rejects a reference_pattern that does not compile", () => {
    const dir = brokersDir({
      "broker-x.yaml": webForm(FORM + 'receipt:\n  selector: "#thanks"\n  reference_pattern: "BA-[0-9"\n'),
    });
    expect(() => loadPlaybooks(dir)).toThrow(/broker-x\.yaml: "receipt\.reference_pattern" is not a valid regular expression/);
  });

  it("rejects a form field whose value is neither a string nor a boolean", () => {
    const form = "form:\n  url: http://localhost/\n  selector: form\n  fields:\n    age: 42\n  submit: button\n";
    const dir = brokersDir({ "broker-x.yaml": webForm(form + RECEIPT) });
    expect(() => loadPlaybooks(dir)).toThrow(/broker-x\.yaml: "form\.fields\.age" must be a string or a boolean/);
  });
});
