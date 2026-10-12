// The fictitious broker A's site, on localhost only, so a confirmed send has something to post to.
// It serves its one page and answers the form's POST. It stores nothing and never logs a request body.
import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

// Reading the page at import is deliberate: it binds no port, and a drifted page fails before serving.
const indexHtml = readFileSync(new URL("index.html", import.meta.url), "utf8");

const REQUEST_TYPES: readonly string[] = ["erasure", "objection", "both"];
const REQUIRED_FIELDS = ["full_name", "email", "request_type", "confirm_identity"];
const MAX_BODY_BYTES = 64 * 1024;

// The thank-you page is the opt-out page without its form and script, with the receipt shown,
// so it carries the same hidden notice. A change to index.html that breaks this fails at startup.
const receiptHtml = [
  [/<form id="opt-out-form"[\s\S]*?<\/form>\s*/, ""],
  [/\s*<script>[\s\S]*?<\/script>/, ""],
  ['<p id="thanks">', '<p id="thanks" style="display: block">'],
].reduce<string>((html, [pattern, replacement]) => {
  const next = html.replace(pattern, replacement as string);
  if (next === html) throw new Error(`sites/broker-a/index.html no longer matches ${pattern}`);
  return next;
}, indexHtml);
if (!receiptHtml.includes("BA-000000")) throw new Error("sites/broker-a/index.html lost the reference");

const rejectionHtml = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Broker A: Opt out</title></head>
<body>
  <h1>Broker A</h1>
  <p>We could not accept your request. Fill in your name and email address, choose what you want us
    to do, and confirm the request is about your own data.</p>
</body>
</html>
`;

export function startSite(port: number): Promise<Server> {
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    if (request.method === "GET" && (path === "/" || path === "/index.html")) {
      send(response, 200, indexHtml);
    } else if (request.method === "POST" && path === "/") {
      answerRequest(request, response).catch(() => response.destroy());
    } else {
      send(response, 404, "Not found\n", "text/plain");
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "localhost", () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}

async function answerRequest(request: IncomingMessage, response: ServerResponse) {
  const fields = await readForm(request);
  if (fields && isValid(fields)) {
    const reference = `BA-${randomInt(100000, 1000000)}`;
    send(response, 200, receiptHtml.replace("BA-000000", reference));
  } else {
    send(response, 400, rejectionHtml);
  }
}

function isValid(fields: URLSearchParams): boolean {
  return (
    REQUIRED_FIELDS.every((name) => fields.get(name)) &&
    REQUEST_TYPES.includes(fields.get("request_type") ?? "")
  );
}

// Reads an urlencoded form body, or returns null if it is not one or is too large.
async function readForm(request: IncomingMessage): Promise<URLSearchParams | null> {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.startsWith("application/x-www-form-urlencoded")) {
    request.resume();
    return null;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  // Drains an oversized body rather than breaking off, so the 400 still reaches the client.
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size <= MAX_BODY_BYTES) chunks.push(chunk);
  }
  if (size > MAX_BODY_BYTES) return null;
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function send(response: ServerResponse, status: number, body: string, type = "text/html") {
  response.writeHead(status, { "content-type": `${type}; charset=utf-8` }).end(body);
}
