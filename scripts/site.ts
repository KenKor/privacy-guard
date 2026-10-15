// `npm run site`: a local stand-in for broker A, on localhost only. It serves broker A's page and
// answers the form POST with a thank-you page carrying a fresh reference, so a confirmed send can
// be tried end to end. It never reads, stores or logs what was submitted.
// Runs with Node's type stripping, like bin/. PORT overrides the port; PORT=0 picks a free one.
import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

const PAGE = new URL("../sites/broker-a/index.html", import.meta.url);
const HOST = "localhost";
const port = Number(process.env.PORT ?? 8080);

const thanks = (reference: string) => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Broker A: Thank you</title></head>
<body>
  <h1>Broker A</h1>
  <p id="thanks">
    Thank you. Your request reference is <strong id="reference">${reference}</strong>. We will reply
    to the email address you gave within one month.
  </p>
</body>
</html>
`;

const server = createServer((req, res) => {
  const html = { "content-type": "text/html; charset=utf-8" };
  if (req.url === "/" && req.method === "GET") {
    res.writeHead(200, html).end(readFileSync(PAGE));
  } else if (req.url === "/" && req.method === "POST") {
    req.resume(); // drain the body unread
    req.on("end", () => {
      const reference = `BA-${String(randomInt(1, 1_000_000)).padStart(6, "0")}`;
      console.log(`POST / answered with ${reference}`);
      res.writeHead(200, html).end(thanks(reference));
    });
  } else {
    req.resume();
    res.writeHead(404, { "content-type": "text/plain" }).end("not found\n");
  }
});

server.listen(port, HOST, () => {
  console.log(`broker A stand-in on http://${HOST}:${(server.address() as AddressInfo).port}/`);
});
