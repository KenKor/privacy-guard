// The local stand-in for broker A, run as `npm run site` runs it, on a free port.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type RunningSite, startSite } from "./helpers/site.ts";

const SUBMITTED = { full_name: "Sam Example", email: "sam.example@example.com", phone: "0600000000" };

let site: RunningSite;
beforeAll(async () => {
  site = await startSite();
});
afterAll(() => site.stop());

const post = () =>
  fetch(site.url, { method: "POST", body: new URLSearchParams({ ...SUBMITTED, request_type: "both", confirm_identity: "on" }) });

describe("npm run site", () => {
  it("listens on localhost", () => {
    expect(site.url).toMatch(/^http:\/\/localhost:\d+\/$/);
  });

  it("serves broker A's page byte for byte", async () => {
    const response = await fetch(site.url);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(readFileSync("sites/broker-a/index.html", "utf8"));
  });

  it("answers a form POST with a fresh reference in #thanks", async () => {
    const first = await post();
    expect(first.status).toBe(200);
    const page = await first.text();
    const reference = /<p id="thanks">[^]*?(BA-\d{6})[^]*?<\/p>/.exec(page)?.[1];
    expect(reference).toMatch(/^BA-\d{6}$/);
    expect(reference).not.toBe("BA-000000");
    const second = /BA-\d{6}/.exec(await (await post()).text())?.[0];
    expect(second).not.toBe(reference);
  });

  it("answers 404 to anything else", async () => {
    expect((await fetch(new URL("/ledger.json", site.url))).status).toBe(404);
    expect((await fetch(new URL("/elsewhere", site.url), { method: "POST", body: "x=1" })).status).toBe(404);
    expect((await fetch(site.url, { method: "PUT", body: "x=1" })).status).toBe(404);
  });

  it("does not echo or log the submitted values", async () => {
    const page = await (await post()).text();
    for (const value of Object.values(SUBMITTED)) {
      expect(page).not.toContain(value);
      expect(site.output()).not.toContain(value);
    }
  });
});
