// The local broker A site, started in-process on a free port (an agent's curl POST is denied by the hook).
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { type HTMLElement, parse } from "node-html-parser";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startSite } from "../sites/broker-a/server.ts";

const indexHtml = readFileSync("sites/broker-a/index.html", "utf8");

// The made-up subject; the site stores nothing.
const validForm = {
  full_name: "Example Subject",
  email: "subject@example.com",
  request_type: "both",
  confirm_identity: "on",
};

const post = (fields: Record<string, string>) =>
  fetch(`${base}/`, { method: "POST", body: new URLSearchParams(fields) });

let server: Server;
let base: string;

beforeAll(async () => {
  server = await startSite(0);
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((done) => server.close(() => done())));

describe("the broker A site", () => {
  it.each(["/", "/index.html", "/?utm_source=test"])("serves broker A's page at %s", async (path) => {
    const response = await fetch(base + path);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(indexHtml);
  });

  it("answers 404 for any other path", async () => {
    const response = await fetch(`${base}/sites/broker-a/server.ts`);
    expect(response.status).toBe(404);
  });

  describe("a valid request POST", () => {
    let status: number;
    let page: HTMLElement;

    beforeAll(async () => {
      const response = await post(validForm);
      status = response.status;
      page = parse(await response.text());
    });

    it("answers 200 with a fresh BA- reference", () => {
      expect(status).toBe(200);
      const reference = page.querySelector("#thanks #reference")?.text;
      expect(reference).toMatch(/^BA-[1-9]\d{5}$/);
      expect(reference).not.toBe("BA-000000");
    });

    it("gives each request a new reference", async () => {
      const again = parse(await (await post(validForm)).text());
      expect(again.querySelector("#reference")?.text).not.toBe(page.querySelector("#reference")?.text);
    });

    it("answers with a thank-you page without the form", () => {
      expect(page.querySelector("form#opt-out-form")).toBeNull();
    });

    it("carries the same hidden notice as broker A's page", () => {
      const notice = parse(indexHtml).querySelector(".notice-for-processing")!.text;
      expect(page.querySelector(".notice-for-processing")?.text).toBe(notice);
    });
  });

  it.each([
    ["missing confirm_identity", { ...validForm, confirm_identity: undefined }],
    ["with an empty full_name", { ...validForm, full_name: "" }],
    ["with a request_type the form does not offer", { ...validForm, request_type: "sell-more" }],
  ])("answers 400 with no reference to a POST %s", async (_, form) => {
    const fields = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== undefined));
    const response = await post(fields as Record<string, string>);
    expect(response.status).toBe(400);
    expect(await response.text()).not.toMatch(/BA-\d/);
  });

  it("ignores a query string on the POST", async () => {
    const response = await fetch(`${base}/?utm_source=test`, {
      method: "POST",
      body: new URLSearchParams(validForm),
    });
    expect(response.status).toBe(200);
  });

  it("answers 400 to a body that is not urlencoded", async () => {
    const response = await fetch(`${base}/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validForm),
    });
    expect(response.status).toBe(400);
  });

  it("answers 400 to a body over 64 KiB", async () => {
    const response = await post({ ...validForm, job_title: "x".repeat(64 * 1024) });
    expect(response.status).toBe(400);
  });

  it("rejects when the port is taken", async () => {
    await expect(startSite((server.address() as AddressInfo).port)).rejects.toThrow(/EADDRINUSE/);
  });

  it("answers 404 to another method on /", async () => {
    const response = await fetch(`${base}/`, { method: "PUT", body: new URLSearchParams(validForm) });
    expect(response.status).toBe(404);
  });
});
