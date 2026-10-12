// Reading the receipt from a broker's response, which is untrusted content.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadPlaybooks } from "../src/playbook.ts";
import { readReceipt } from "../src/receipt.ts";

const brokerA = loadPlaybooks("brokers").find((playbook) => playbook.name === "broker-a")!;
const indexHtml = readFileSync("sites/broker-a/index.html", "utf8");

const thanksPage = (thanks: string) => `<!doctype html><html><body><h1>Broker A</h1><p id="thanks">${thanks}</p></body></html>`;

describe("readReceipt", () => {
  it("reads the reference from the receipt element", () => {
    const page = thanksPage('Thank you. Your reference is <strong id="reference">BA-482915</strong>.');
    expect(readReceipt(page, brokerA)).toEqual({ reference: "BA-482915" });
  });

  it("finds no reference when the receipt element holds none", () => {
    expect(readReceipt(thanksPage("Thank you. We will be in touch."), brokerA)).toEqual({ missing: "no-reference" });
  });

  it("finds no reference when the page has no receipt element", () => {
    expect(readReceipt("<html><body><p>Something went wrong.</p></body></html>", brokerA)).toEqual({ missing: "no-reference" });
  });

  it("ignores a reference outside the receipt element", () => {
    const page = `<html><body><p>Example: BA-123456</p><p id="thanks">Thank you.</p></body></html>`;
    expect(readReceipt(page, brokerA)).toEqual({ missing: "no-reference" });
  });

  it("treats the form page returned, with its BA-000000 placeholder, as no receipt", () => {
    expect(indexHtml).toContain("BA-000000");
    expect(readReceipt(indexHtml, brokerA)).toEqual({ missing: "form-returned" });
  });

  it("takes only the reference from a page carrying the hidden notice", () => {
    const page = indexHtml
      .replace(/<form id="opt-out-form"[\s\S]*?<\/form>/, "")
      .replace("BA-000000", "BA-482915");
    expect(page).toContain("notice-for-processing");
    expect(readReceipt(page, brokerA)).toEqual({ reference: "BA-482915" });
  });
});
