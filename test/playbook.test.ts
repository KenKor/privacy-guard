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
});
