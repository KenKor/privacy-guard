# Web forms are submitted by a plain HTTP POST, not a browser

From D-4 in [docs/prds/completed/opt-out-broker-a.md](../prds/completed/opt-out-broker-a.md).

A confirmed send makes one `fetch` POST of the playbook's fields to `form.url`, form-encoded, with no
browser involved. Redirects are not followed (`redirect: "manual"`), the whole exchange has a
10-second timeout, and reading the response stops at 1 MB. The receipt reference is read from a 2xx
response with `node-html-parser`, which runs no script. Only the matched reference is kept; nothing
else in the page is printed, stored or acted on. Broker A's form submits without script, and its
page is untrusted content (it carries a prompt injection). Driving a browser would run that script
in order to submit a form that doesn't need it.

## Considered Options

- **A headless browser.** A heavy dependency that runs the broker's untrusted script.
- **A prepared request the human submits by hand.** The receipt, and so the deadline, would depend
  on a manual copy that the ledger can't check.
- **Following redirects.** `fetch` posts the subject's fields again on a 307 or 308, possibly to
  another origin. A redirect is treated as a send with no receipt instead
  ([ADR-0004](0004-send-without-receipt-stays-visible.md)).

## Consequences

A future broker whose form needs script to submit doesn't fit the `web-form` channel as built. It
needs its own decision, not a quiet switch to a browser.
