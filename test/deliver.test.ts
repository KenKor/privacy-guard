// The HTTP deliver, against the in-process broker A site and small local servers on free ports.
// Nothing here contacts anything but localhost.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { main } from "../src/cli.ts";
import { loadLedger, saveLedger } from "../src/ledger.ts";
import { loadPlaybooks } from "../src/playbook.ts";
import { readReceipt } from "../src/receipt.ts";
import { failureOf, httpDeliver, isPreConnection, MAX_RESPONSE_BYTES, type SendRequest } from "../src/send.ts";
import { startSite } from "../sites/broker-a/server.ts";

const brokerA = loadPlaybooks("brokers").find((playbook) => playbook.name === "broker-a")!;

// The made-up subject; the site stores nothing.
const fields = [
  { name: "full_name", value: "Alex Example" },
  { name: "email", value: "alex.example@example.org" },
  { name: "request_type", value: "both" },
  { name: "confirm_identity", value: "on" },
];

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((done) => server.close(done))));
});

const urlOf = (server: Server) => `http://localhost:${(server.address() as AddressInfo).port}/`;
const request = (url: string): SendRequest => ({ broker: "broker-a", url, fields });

async function localSite(): Promise<Server> {
  const site = await startSite(0);
  servers.push(site);
  return site;
}

async function serve(listener: RequestListener): Promise<Server> {
  const server = createServer(listener);
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "localhost", done));
  return server;
}

describe("httpDeliver", () => {
  it("posts the fields form-encoded and the receipt is read from the answer", async () => {
    const site = await localSite();
    const outcome = await httpDeliver(request(urlOf(site)));
    expect(outcome).toMatchObject({ kind: "response", status: 200 });
    if (outcome.kind !== "response") return;
    expect(readReceipt(outcome.body, brokerA)).toEqual({ reference: expect.stringMatching(/^BA-[1-9]\d{5}$/) });
  });

  it("returns the status of a rejected submission", async () => {
    const site = await localSite();
    const outcome = await httpDeliver({ broker: "broker-a", url: urlOf(site), fields: fields.slice(0, 2) });
    expect(outcome).toMatchObject({ kind: "response", status: 400 });
  });

  it("does not follow a redirect", async () => {
    const site = await localSite();
    let posts = 0;
    site.on("request", (incoming) => incoming.method === "POST" && posts++);
    const redirector = await serve((_, response) => response.writeHead(307, { location: urlOf(site) }).end());
    const outcome = await httpDeliver(request(urlOf(redirector)));
    expect(outcome).toMatchObject({ kind: "response", status: 307 });
    expect(posts).toBe(0);
  });

  it("stops reading a response over 1 MB and returns no body to parse", async () => {
    const receipt = '<p id="thanks"><strong id="reference">BA-482915</strong></p>';
    const server = await serve((_, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(receipt + " ".repeat(MAX_RESPONSE_BYTES));
    });
    expect(await httpDeliver(request(urlOf(server)))).toEqual({ kind: "failed", reason: "too-large" });
  });

  it("times out over the whole exchange", async () => {
    const server = await serve((_, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.write("<html>"); // and never ends
    });
    expect(await httpDeliver(request(urlOf(server)), { timeoutMs: 100 })).toEqual({ kind: "failed", reason: "timeout" });
  });

  it("names a refused connection, which is pre-connection", async () => {
    const server = await serve(() => {});
    const url = urlOf(server);
    await new Promise((done) => server.close(done));
    servers.splice(servers.indexOf(server), 1);
    const outcome = await httpDeliver(request(url));
    expect(outcome).toEqual({ kind: "failed", reason: "error", code: "ECONNREFUSED" });
    expect(isPreConnection(outcome)).toBe(true);
  });

  it("names a reset after sending, which may have reached the broker", async () => {
    const server = await serve((incoming) => incoming.socket.destroy());
    const outcome = await httpDeliver(request(urlOf(server)));
    expect(outcome).toMatchObject({ kind: "failed", reason: "error" });
    expect(isPreConnection(outcome)).toBe(false);
  });
});

describe("a confirmed send through httpDeliver", () => {
  it("submits broker A's form to the in-process site and records the receipt", async () => {
    const site = await localSite();
    const dir = mkdtempSync(join(tmpdir(), "deliver-"));
    const brokersDir = join(dir, "brokers");
    mkdirSync(brokersDir);
    writeFileSync(join(brokersDir, "broker-a.yaml"), readFileSync("brokers/broker-a.yaml", "utf8").replace("http://localhost:8080/", urlOf(site)));
    const ledgerPath = join(dir, "ledger.json");
    saveLedger(ledgerPath, { entries: [{ broker: "broker-a", state: "drafted", dates: { drafted: "2026-10-12" } }] });
    const lines: string[] = [];
    const env = {
      ledgerPath,
      brokersDir,
      subjectPath: "subject.example.yaml",
      today: "2026-10-12",
      print: (line: string) => lines.push(line),
      deliver: httpDeliver,
    };
    expect(await main(["send", "broker-a", "--confirm"], env)).toBe(0);
    expect(lines).toEqual([expect.stringMatching(/^sent to broker-a, receipt BA-[1-9]\d{5}, due 2026-11-12$/)]);
    expect(loadLedger(ledgerPath).entries[0]).toMatchObject({ state: "sent", reference: expect.stringMatching(/^BA-/) });
  });
});

describe("isPreConnection", () => {
  it("is true only for a refused connection or an unknown host", () => {
    expect(isPreConnection({ kind: "failed", reason: "error", code: "ENOTFOUND" })).toBe(true);
    expect(isPreConnection({ kind: "failed", reason: "error", code: "ECONNREFUSED" })).toBe(true);
    expect(isPreConnection({ kind: "failed", reason: "error", code: "UND_ERR_SOCKET" })).toBe(false);
    expect(isPreConnection({ kind: "failed", reason: "error" })).toBe(false);
    expect(isPreConnection({ kind: "failed", reason: "timeout" })).toBe(false);
    expect(isPreConnection({ kind: "response", status: 500, body: "" })).toBe(false);
  });
});

describe("failureOf", () => {
  const fetchFailed = (cause?: unknown) => Object.assign(new TypeError("fetch failed"), { cause });
  const withCode = (code: string) => Object.assign(new Error(code), { code });

  it("takes the cause's code", () => {
    expect(failureOf(fetchFailed(withCode("ECONNREFUSED")))).toEqual({ kind: "failed", reason: "error", code: "ECONNREFUSED" });
  });

  it("counts a failure with no cause code as one that may have reached the broker", () => {
    expect(isPreConnection(failureOf(fetchFailed()))).toBe(false);
    expect(isPreConnection(failureOf(new Error("boom")))).toBe(false);
  });

  it("counts an AggregateError as pre-connection only when every error in it is", () => {
    const refusedTwice = new AggregateError([withCode("ECONNREFUSED"), withCode("ECONNREFUSED")]);
    expect(isPreConnection(failureOf(fetchFailed(refusedTwice)))).toBe(true);
    const mixed = new AggregateError([withCode("ECONNREFUSED"), withCode("ECONNRESET")]);
    expect(failureOf(fetchFailed(mixed))).toEqual({ kind: "failed", reason: "error", code: "ECONNRESET" });
    const oneWithoutCode = new AggregateError([withCode("ECONNREFUSED"), new Error("no code")]);
    expect(isPreConnection(failureOf(fetchFailed(oneWithoutCode)))).toBe(false);
    expect(isPreConnection(failureOf(fetchFailed(new AggregateError([]))))).toBe(false);
  });
});
