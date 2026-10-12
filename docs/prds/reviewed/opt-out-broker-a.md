# Opt out of broker A

**Issue:** #2

**Hook:** Ask broker A through its web form to erase the subject's data and stop selling it: `draft`
the request, submit the form only on a confirmed send, record the receipt reference from broker A's
thank-you page, record the reply by hand, and have `report` flag the request as overdue from the day
after its due date (one calendar month after it was sent).

**Status:** reviewed, 2026-10-12. Written from a completed grilling session with the user, the
evidence in the repo, and the user's decisions in the review session that followed. All decisions
are resolved (D-1 to D-16), and the PRD moved to `reviewed/` on the user's confirmation. Tickets
published 2026-10-12 as #7 to #17 (sub-issues of #2). Code facts verified at `66295b1`.

## Purpose and background

privacy-guard asks data brokers to stop selling one person's data (GDPR Articles 17 and 21) and holds
each broker to the one-month deadline for its reply ([GLOSSARY.md](../../../GLOSSARY.md)). Issue #2
asks for the first end-to-end path: one broker, broker A, from draft to deadline. The user's
requirement for scope: "I want the deadline to mean something from day one." So the path ends not at
the send but at a command that says, without being asked twice, that broker A has missed its deadline.

Broker A takes requests through a web form (D-2). Its own page says so: "Fill in the form below. ...
Requests sent by email or post are not accepted." (`sites/broker-a/index.html` lines 31-32). The form
(lines 44-68) asks for a full name and an email address (required), a phone number and a job title
(optional), a choice of erasure, objection or both (required), and a checkbox confirming the request is
about the subject's own data (required). After a submission it shows a reference such as `BA-000000`
in its thank-you element (lines 70-73).

What the skeleton (`66295b1`) already has, and what this PRD builds on:

| Where | What is there now | What this PRD does with it |
|---|---|---|
| `src/cli.ts` | Commands `due`, `draft` (line 21: prints "draft is not implemented yet"), `send` (line 42, sends every `drafted` entry through `guardedSend`; `deliver` is `noChannel`, line 58, which throws). Arguments after the command are only searched for `--confirm` (lines 16, 24). `CliEnv` holds `ledgerPath`, `today`, `print` (lines 5-10) | Implements `draft <broker>` and `send <broker> [--confirm]`; adds `reply`, `receipt`, `discard`, `escalate` and `report`; `CliEnv` gains the seams in Test seams; `due` unchanged |
| `src/send.ts` | `guardedSend(request, { confirm, deliver })`: returns `{ sent: false, reason: "dry-run" }` without `confirm`, else calls `deliver` (lines 12-19); `Deliver` returns nothing (line 8) | Keeps the guard; `deliver` becomes an HTTP form submission that returns the outcome; `SendRequest` (line 4, `{ broker }` only) carries the form's address and fields |
| `src/ledger.ts` | `STATES = ["drafted", "sent", "acknowledged", "overdue", "escalated"]` (line 8); `dates: { drafted?, sent?, acknowledged?, due? }` (line 17); line 3: "Deadline logic ... is not here yet; whoever records an entry sets its due date"; `dueOn` (line 54) | Drops stored `overdue` (D-10); adds `reference`, `dates.submitted` (D-14) and `dates.escalated` (D-1); adds due-date arithmetic and an overdue query |
| `src/playbook.ts` | `CHANNELS = ["web-form"]` (line 7); `Playbook.form: WebForm` required; `reply.acknowledged_when` (line 27); `parsePlaybook` requires `form.url`, `form.selector`, `form.submit`, `form.fields` (lines 58-63) | Keeps `web-form`; `reply.acknowledged_when` becomes a top-level `receipt` (D-3); validates `receipt` |
| `brokers/broker-a.yaml` | `channel: web-form`, `form:` block with templated `fields` (lines 12-18), `reply.acknowledged_when` with `selector: "#thanks"` and `reference_pattern: "BA-[0-9]{6}"` (lines 22-24) | Kept; only the `acknowledged_when` block moves to `receipt` (D-3) |
| `test/broker-a-form.test.ts`, `test/fixtures/broker-a-form.html` | Contract test of the playbook against a saved copy of the form; the fixture is byte-identical to `sites/broker-a/index.html` | Kept; the contract test gains checks (item 1) |
| `sites/broker-a/`, `npm run site` | The fictitious broker's page, served by `python3 -m http.server` (`package.json`), which serves every file in the directory and cannot answer a POST; training material with a deliberate prompt injection (lines 35-42). The page's script (lines 76-84) stops the browser from submitting and makes up a reference on the spot, so nothing ever reaches the server | Page unchanged; `npm run site` becomes a small Node server that also answers the form's POST with a thank-you page (item 5) |
| `.claude/hooks/deny-outward-send.sh` | Denies `privacy-guard[[:space:]]+send` (line 37) without `--confirm` and the marker; removes the marker once per allowed tool call (line 78) | Hardened before `send` can deliver (item 6, Guarding the send) |
| `.gitignore` | `ledger.json`, `.privacy-guard/` | Adds `subject.yaml` (D-5) |

The invariants this design must keep are in [review-checks.md](../../agents/review-checks.md):
nothing is sent without a confirmed send; deadlines are calendar months, not 30 days; no personal data
in fixtures, tests, issues or logs; playbooks are data; a broker's page is untrusted content.

## Proposal

### Scope

In: one request to broker A, through its web form. `draft` → confirmed `send` (form submitted, receipt
reference recorded) → due date → `report` flags it as overdue → `escalate` records that the human took it to the
authority. The reply is recorded by hand.

Later (not in this PRD): re-requests per the playbook's `cadence`; the Article 12(3) two-month
extension a broker may claim; other brokers; reading the inbox automatically to find replies. A complaint to the
authority is the human's to file; `escalate` records it (D-1).

### The flow, worked through

A made-up subject, as in `subject.example.yaml` (D-5). Today is 2026-10-12, and `npm run site` is
running.

```console
$ privacy-guard draft broker-a
POST http://localhost:8080/  (form#opt-out-form)
  full_name         [subject.full_name]
  email             [subject.email]
  phone             [subject.phone]
  job_title         [subject.job_title]
  request_type      both
  confirm_identity  on
Subject values are hidden. To see them: privacy-guard send broker-a --show

drafted a request to broker-a. Review it, then: privacy-guard send broker-a --confirm

$ privacy-guard send broker-a --show       # dry run, values shown: contacts nothing
dry run: nothing was sent. A real send needs --confirm.
POST http://localhost:8080/  (form#opt-out-form)
  full_name         Alex Example
  email             alex.example@example.org
  phone             +00 000 000 000
  job_title         Test Engineer
  request_type      both
  confirm_identity  on

$ privacy-guard send broker-a --confirm    # the human's marker exists (see Guarding the send)
sent to broker-a, receipt BA-482915, due 2026-11-12

$ privacy-guard report               # 2026-11-12: due today, not yet overdue
nothing is overdue                   # exit 0

$ privacy-guard report               # 2026-11-13: no reply recorded
broker-a: sent 2026-10-12, due 2026-11-12, 1 day overdue     # exit 1
```

Had the reply arrived on 2026-11-05, `privacy-guard reply broker-a 2026-11-05` would have marked the
request `acknowledged`, and both `report` runs would say "nothing is overdue".

If broker A's answer had carried no receipt (D-14), the request stays `drafted` and stays visible:

```console
$ privacy-guard send broker-a --confirm
broker-a answered 200 without a receipt reference; the request may or may not have arrived.
Check broker A's mail before sending again.        # exit 1; entry stays drafted, submitted 2026-10-12

$ privacy-guard report               # every day until resolved
broker-a: submitted 2026-10-12, no receipt          # exit 1

$ privacy-guard receipt broker-a BA-482915          # broker A's mail shows the first attempt arrived
recorded receipt BA-482915 for broker-a: sent 2026-10-12, due 2026-11-12
```

The ledger after the send. It holds the broker, the state, the dates and the receipt's reference,
nothing about the subject:

```json
{
  "entries": [
    {
      "broker": "broker-a",
      "state": "sent",
      "reference": "BA-482915",
      "dates": { "drafted": "2026-10-12", "sent": "2026-10-12", "due": "2026-11-12" }
    }
  ]
}
```

### Playbook (D-2, D-3, D-7)

`brokers/broker-a.yaml` keeps its channel, form and fields. Only the block that finds the reference
changes, from `reply.acknowledged_when` to `receipt`:

```yaml
# Broker A: opt out by web form. Fictitious broker for the training sandbox.
name: broker-a
display_name: Broker A
jurisdiction: EU
legal_basis:
  - gdpr-art-17   # right to erasure
  - gdpr-art-21   # right to object
channel: web-form
form:
  url: http://localhost:8080/
  selector: "form#opt-out-form"
  fields:
    full_name: "{{ subject.full_name }}"
    email: "{{ subject.email }}"
    phone: "{{ subject.phone | optional }}"
    job_title: "{{ subject.job_title | optional }}"
    request_type: both
    confirm_identity: true
  submit: "button#submit_request"
receipt:
  selector: "#thanks"
  reference_pattern: "BA-[0-9]{6}"
reply:
  deadline: one-month     # GDPR Article 12(3)
cadence: every-90-days    # brokers re-add people; ask again (Later)
dry_run: true             # sending is a separate, confirmed step
```

In `src/playbook.ts`, `Playbook.reply.acknowledged_when` becomes
`Playbook.receipt: { selector: string; reference_pattern: string }`. For `channel: web-form`,
`parsePlaybook` also requires `receipt.selector` and `receipt.reference_pattern` as strings, requires
the pattern to compile as a regular expression, and requires every `form.fields` value to be a string
or a boolean. Each new failure names the file and the field.

How a playbook's fields become the submitted form:

- **Address.** The form is posted to `form.url`. Broker A's form has `action="#"` (line 44), which a
  browser resolves to the page's own address; the contract test pins that (item 1), so a broker whose
  form posts elsewhere fails the test instead of being posted to the wrong place.
- **Encoding.** `application/x-www-form-urlencoded`, as the form has no `enctype` (line 44).
- **String values** are rendered from `subject.yaml` (Field rendering, below) and sent as they are.
- **`true`** is sent as `on`, which is what a browser sends for a checked checkbox without a `value`
  attribute, as `confirm_identity` is (line 64). The contract test asserts every boolean field is such
  a checkbox. **`false`** leaves the field out, as an unchecked box does.
- **`submit`** is not sent: broker A's button has no `name` (line 67). It stays in the playbook for
  the contract test.

### Subject file (D-5)

`subject.yaml`, git-ignored, written by the human:

```yaml
full_name: "Alex Example"
email: "alex.example@example.org"
phone: "+00 000 000 000"     # optional
job_title: "Test Engineer"   # optional
```

A committed `subject.example.yaml` holds the made-up subject above; tests use it. Every value must be
a YAML string: `draft` and `send` refuse any other type, naming the key and the file and saying to
quote the value. The rule exists because the `yaml` package reads an unquoted `phone: 0612345678` as
the number 612345678, silently losing the leading zero, and broker A would get a wrong number.

Only `draft` and `send` read `subject.yaml`, and only to render the form's fields. Its values are
never written to the ledger, to an error message or to any log. A missing `subject.yaml`, or one
without `full_name` or `email`, makes `draft` and `send` refuse, naming the file and the missing key
(never a value) and pointing at `subject.example.yaml`.

### Field rendering (D-7)

The request is the form's fields; there is no letter, because broker A's form has no free-text field
(lines 44-68). Placeholders in `form.fields`: `{{ subject.full_name }}`, `{{ subject.email }}`,
`{{ subject.phone }}`, `{{ subject.job_title }}`, each optionally followed by `| optional`. A field
whose `| optional` placeholder has no value is sent empty, as a browser sends an empty text input. A
placeholder without `| optional` that has no value, or a placeholder the renderer does not know, fails
the render, naming the field and the placeholder. The renderer is generic; nothing in `src/` names a
broker A field.

**Printing a submission.** `draft` and the dry run of `send` print the address, the form's selector,
and each field. A value that came from `subject.yaml` is masked by default as its placeholder
(`[subject.email]`), or `(empty)` when an optional value is absent; literal playbook values
(`request_type`, `confirm_identity`) print as they are. `--show` prints the subject's values. Masking
is the default because an agent's tool output is kept in its transcript, and review-checks forbids
personal data in logs; the human asks for the values in their own terminal. Errors never print a
subject value, with or without `--show`.

### Commands

| Command | Reads | Writes | Exit |
|---|---|---|---|
| `draft <broker> [--show]` | playbook, `subject.yaml`, ledger | new entry `{ broker, state: "drafted", dates: { drafted: today } }` | 0; 1 on refusal |
| `send <broker> [--confirm] [--show]` | ledger, playbook, `subject.yaml` | on a receipt: `state: "sent"`, `dates.sent`, `dates.due`, `reference`; on a submission without one: `dates.submitted` (D-14) | 0; 1 on refusal or no receipt; 2 without a broker |
| `reply <broker> [YYYY-MM-DD]` | ledger | `state: "acknowledged"`, `dates.acknowledged` (default today) | 0; 1 on refusal |
| `escalate <broker> [YYYY-MM-DD]` | ledger | `state: "escalated"`, `dates.escalated` (default today) on the broker's overdue `sent` entry | 0; 1 on refusal |
| `receipt <broker> [reference]` | ledger, playbook | `state: "sent"`, `dates.sent`, `dates.due`, and `reference` when given, on the broker's `drafted` entry that has `dates.submitted` | 0; 1 on refusal |
| `discard <broker>` | ledger | removes the broker's `drafted` entry that has `dates.submitted` | 0; 1 on refusal |
| `report` | ledger | nothing | 1 if anything is overdue, a `sent` request has no due date, a submission has no receipt, or an escalated request has no reply; else 0 |
| `due` | ledger | nothing | unchanged: lists entries not `acknowledged` with `dates.due <= today` (`src/ledger.ts` line 56) |

An **open request** is one whose state is not `acknowledged` (`drafted`, `sent`, `escalated`).

- **`draft <broker>`** (D-8). Refuses when the broker has no playbook or already has an open request
  (naming the state and date). Renders the fields first and writes the ledger entry only when the
  render succeeded, then prints the submission, masked unless `--show`. The rendered values are not
  stored: `send` renders them again from the playbook and `subject.yaml`, so an edit to either between
  draft and send shows in the dry run.
- **`send <broker> [--confirm]`** (D-4, D-13). Flags may come before or after the broker, as in the
  hook's self-test. Refuses, exit 1, when the broker has no playbook, has no `drafted` entry, or has
  more than one (a hand-edited ledger; nothing is sent). Without `--confirm`, prints the submission
  under the existing "dry run: nothing was sent" line, masked unless `--show`, and contacts nothing.
  With `--confirm`, renders, submits the form through `guardedSend` (Submission, below), and reads the
  receipt from the response (Receipt, below). On a receipt: `state: "sent"`, `dates.sent` (the entry's
  `dates.submitted` when it has one, else today; D-16), `dates.due = dueDate(dates.sent)`,
  `reference`, ledger saved, and
  "sent to broker-a, receipt BA-482915, due 2026-11-12". When the exchange failed before a
  connection was made, and the failure is positively identified as that (cause `ENOTFOUND` or
  `ECONNREFUSED`), nothing reached broker A: the entry is unchanged (an earlier `dates.submitted` stays),
  `send` prints "nothing was sent to <broker>" with the error kind, and exits 1. Every other outcome
  without a receipt (a timeout, a reset after sending, an error status, a redirect, a response over
  the cap, the form returned, no reference) may have reached broker A (D-14): the entry stays
  `drafted`, `dates.submitted` is set to today unless it already holds an earlier date (the first
  attempt's date stays, so a later `receipt` never pushes the due date past what the law allows),
  `send` prints which case it was, never the page's text, and exits 1. A failure that cannot be
  identified as pre-connection counts as one that may have reached broker A: `fetch` reports
  every failure as `TypeError: fetch failed`, and only `cause.code` tells them apart. Measured on
  Node 22.23.2 against a closed local port: a refused connection is `ECONNREFUSED`, an unknown host
  `ENOTFOUND`, a reset after sending `UND_ERR_SOCKET`. A failure with no code, or another code,
  counts as may have reached broker A, and so does an `AggregateError` unless every error in it
  carries one of the two. Unmeasured: the dual-stack `localhost` case (this host resolves it to
  IPv4 only). A `send` of an entry that has `dates.submitted`, dry run or
  confirmed, first prints "a submission on <date> got no receipt; check broker A's mail before sending
  again". Without a broker: usage, exit 2.
- **`reply <broker> [YYYY-MM-DD]`** (D-9). Marks the broker's open request in state `sent` or
  `escalated` as `acknowledged`, with `dates.acknowledged` the given date or today. Refuses a date that
  is not `YYYY-MM-DD`, lies after today, or lies before `dates.sent`.
- **`escalate <broker> [YYYY-MM-DD]`** (D-1). Records that the human took an overdue request to the
  supervisory authority; privacy-guard files nothing and sends nothing. Accepts only the broker's
  `sent` entry that is overdue (a due date set, `today > dates.due`), and otherwise refuses, exit 1,
  naming why: no entry, not overdue (with its due date), `drafted`, `acknowledged`, or already
  `escalated`. Sets `state: "escalated"` and `dates.escalated` to the given date or today. Refuses a
  date that is not `YYYY-MM-DD`, lies after today, or lies before `dates.sent`. Prints "recorded
  broker-a as escalated 2026-11-16; it stays in report until a reply is recorded".
- **`receipt <broker> [reference]`** (D-14, D-15). Records that a submission arrived, for one that
  yielded no receipt. The reference is optional: broker A's mail may carry none. Refuses, exit 1,
  unless the broker has a `drafted` entry with `dates.submitted`, and refuses a reference that does
  not match the playbook's `receipt.reference_pattern`, naming the pattern. Then sets
  `state: "sent"`, `dates.sent` to `dates.submitted` and `dates.due` to `dueDate(dates.submitted)`,
  and `reference` when one was given, and prints "recorded receipt BA-482915 for broker-a: sent
  2026-10-12, due 2026-11-12" (without a reference: "recorded broker-a as sent 2026-10-12, due
  2026-11-12, no reference"). The sent date is the first submission's, on the human's word that it
  arrived; if that makes the request already overdue, `report` says so on its next run.
- **`discard <broker>`** (D-15). Ends a submission that did not arrive or that the human withdraws.
  Refuses, exit 1, unless the broker has a `drafted` entry with `dates.submitted`, naming what it
  found instead (no entry, a `drafted` entry with no submission, or the state). Otherwise removes the
  entry, prints "discarded broker-a: drafted 2026-10-12, submitted 2026-10-12", and exits 0. The
  broker then has no open request, so `draft` works again. Nothing is sent and nothing but the
  ledger is touched.
- **`report`** (D-11, D-14). Lists overdue requests, one line each: broker, sent date, due date, days
  overdue. "nothing is overdue" and exit 0 when there are none; exit 1 when there is at least one, so a
  scheduled job notices. A `sent` entry without `dates.due` cannot be judged overdue or not; `report`
  prints it as a warning line ("broker-x: sent 2026-09-01, no due date recorded") and counts it toward
  exit 1, because passing it silently would be a false green. A `drafted` entry with
  `dates.submitted` is listed too, as "broker-a: submitted 2026-10-12, no receipt", and counts toward
  exit 1 until `receipt`, `discard` or a send that gets a receipt resolves it (D-14, D-15). An `escalated` entry is listed
  as "broker-a: escalated 2026-11-16, no reply" and counts toward exit 1 until `reply` records one
  (D-1): `report` exits 1 while any request past its due date, or any attempt, is unresolved, and
  nothing snoozes it. The submission line is the one line `report` prints that is not about a
  deadline.

### Submission (D-4)

The confirmed send is one HTTP POST with Node's built-in `fetch` (Node 22.18+, `package.json`
`engines`), so no new dependency:

- **No redirects are followed** (`redirect: "manual"`). Following one would post the subject's fields
  again, possibly to another origin (`fetch` re-posts on 307 and 308). A redirect response yields no
  receipt (D-14).
- **10-second timeout** over the whole exchange, including reading the body.
- **1 MB response cap.** Reading stops at 1 MB; a larger response is not parsed and yields no receipt
  (D-14).

`deliver` returns the outcome: a status and a body, or why there is none (connection failed, timed
out, over the cap), with the failure's cause code when `fetch` gives one. Only a failure identified
as `ENOTFOUND` or `ECONNREFUSED` means nothing reached broker A (Commands, `send`); every other
outcome without a receipt is D-14's.

### Receipt (D-3, D-4, D-14)

The receipt reference is read only from a 2xx response to the confirmed POST. `send` takes the text of
the first element matching `receipt.selector` and the first match of `receipt.reference_pattern` in
it. The response is a broker's page and therefore untrusted content: it is parsed with
`node-html-parser`, which runs no script, and nothing from it is printed, stored or acted on except the
matched reference. The page's hidden notice (lines 35-42) is text like any other. `node-html-parser`
moves from `devDependencies` to `dependencies`, since `send` now parses the response.

Broker A's form page itself carries the placeholder `BA-000000` in its hidden thank-you element
(line 71), and it matches the pattern. A server that answered the POST with the unchanged form page
would therefore look like a receipt. D-14 treats a response that still contains
`form.selector` as no receipt, whatever the pattern finds.

### Test seams

`CliEnv` (`src/cli.ts` lines 5-10) gains `brokersDir`, `subjectPath` and `deliver`, beside `ledgerPath`,
`today` and `print`. The defaults are `brokers/`, `subject.yaml` and the HTTP `deliver`, with paths
relative to the working directory, as `DEFAULT_LEDGER_PATH` already is (`src/ledger.ts` line 6): the
CLI is run from the repo root. Tests pass a temporary ledger, `test/`-local playbooks or `brokers/`,
`subject.example.yaml`, and a fake `deliver`. The bin test (`test/cli.test.ts` lines 96-101) runs `due`
from a temporary directory and reads only the ledger, so it is unaffected.

### Due date and overdue (D-6, D-10)

`dueDate(sent)` is one calendar month after the sent date; when the target month has no such day, the
last day of that month. Computed on the `YYYY-MM-DD` string, no time zone involved (the CLI's `today`
is already a local calendar date, `src/cli.ts` line 70).

| Sent | Due |
|---|---|
| 2026-10-12 | 2026-11-12 |
| 2026-12-15 | 2027-01-15 |
| 2026-01-31 | 2026-02-28 |
| 2028-01-31 | 2028-02-29 |
| 2026-03-31 | 2026-04-30 |
| 2026-08-31 | 2026-09-30 |

(Computed with a throwaway Node script, not with project code.)

A request is **overdue** on `today` when its stored state is `sent`, it has a due date, and
`today > dates.due`. On the due date itself it is not overdue. Days overdue is the number of calendar
days from the due date to today (2026-11-12 to 2026-11-13: 1). Overdue is computed on every read and
never stored, so `overdue` leaves `STATES`; `escalated` stays: `escalate` sets it on an overdue `sent`
request (D-1), `report` lists it every day, and `reply` ends it. `acknowledged` ends the question.

No code writes `overdue` today (grep at `66295b1`: the only stored use is the test fixture at
`test/ledger.test.ts` line 52). A hand-edited ledger that still holds it fails `loadLedger` with the
existing message, which names the file, the entry and the allowed states (`src/ledger.ts` line 38).

### Guarding the send (D-4, D-13)

Two layers stand between an agent and a confirmed send: `--confirm` on the command, checked by
`guardedSend`, and the human's one-shot marker `.privacy-guard/confirmed`, checked by
[deny-outward-send.sh](../../../.claude/hooks/deny-outward-send.sh) on an agent's tool call. A human
running the command in their own terminal needs `--confirm` only.

Today the hook has two gaps that matter once `send` can deliver (item 7), which is why item 6 hardens
it first:

- **It misses other ways of running the CLI.** Its pattern `privacy-guard[[:space:]]+send` (line 37)
  does not match `node bin/privacy-guard.js send broker-a --confirm` (the bin's own way of running,
  `bin/privacy-guard.js` line 2) or `node src/cli.ts send ...`, so those skip the marker check.
- **One marker can cover several sends.** The hook removes the marker once per tool call it lets
  through (line 78), and one tool call can chain commands (`;`, `&&`, a loop). D-13 bounds one command
  to one message; the hook must bound one approval to one command.

The hook denies `send` without `--confirm` (line 72; self-test line 117), so an agent cannot run the
dry run through the binary. For an agent, `draft` is the preview, masked by default; tests call
`main()` directly and are unaffected. The hook stays a tripwire, not a wall (its header, lines 10-12):
these changes close the obvious paths, not every path.

Tests never reach a broker: the CLI tests inject `deliver`, and the HTTP `deliver` is tested against
the local site started in-process on a free port, a local stub as the tester agent's send tier
requires.

### The local site (`npm run site`)

`npm run site` serves `sites/broker-a/index.html` on `localhost:8080` at `/` and `/index.html` (the
hook's self-test fetches `/index.html`, line 113), and answers a POST to `/`:

- **Valid submission** (`full_name`, `email`, `request_type` and `confirm_identity` present and
  non-empty, `request_type` one of the three options): 200 and a thank-you page without the form,
  whose `<p id="thanks">` holds `<strong id="reference">BA-NNNNNN</strong>`, six random digits from
  100000 to 999999, so never the `BA-000000` placeholder. The page carries the same hidden notice as
  `index.html` (lines 35-42), so the send path's handling of untrusted content is exercised on the
  response too.
- **Invalid submission:** 400 and a page with no reference.
- **Any other path or method:** 404. Unlike the Python server, it serves no other file.

It stores nothing and never logs a request body. `sites/broker-a/server.ts` exports `startSite(port)`
and holds no top-level side effects, so tests import it and start it on a free port;
`sites/broker-a/main.ts` calls `startSite(8080)`, and `npm run site` runs `node sites/broker-a/main.ts`,
as `bin/privacy-guard.js` runs TypeScript directly.

## Decisions

**Walk order (as walked):** D-15, D-1, D-16. D-15 and D-16 complete D-14's answer. D-1 was walked
before D-16 at the user's request; D-16 touched it only through option (c), which was rejected.

D-2, D-3, D-5, D-6, D-8, D-10, D-11 and D-12 were settled with the user in the grilling session of
2026-10-12. D-2's channel, D-4 and D-13 were decided by the user, and D-7 and D-9 confirmed by the
user, in the review session the same day, after the PRD review found that the grilling's premise for
broker A's channel had no support in the repo. D-14 and D-15 were decided by the user in the walk of
the same day.

### D-14: What does `send` do when a confirmed submission yields no receipt?

**RESOLVED 2026-10-12 with the user: option (c), the attempt is recorded and the request stays
`drafted` until the human resolves it.** A confirmed send that may have reached broker A but yielded
no receipt leaves the entry `drafted` with `dates.submitted` (the first attempt's date), exits 1, and
keeps showing in `report` (exit 1) every day. The way out is a later send that gets a receipt, or
`receipt <broker> [reference]` once broker A's mail shows the first attempt arrived, or `discard <broker>`
when it did not or the request is withdrawn (D-15); a `send` of an
entry with a recorded submission warns first. The user's reason: a failed send must stay visible until
they resolve it, and a silent failure in a scheduled job is the worst case. A 2xx response that still
contains `form.selector` counts as no receipt whatever the pattern finds. Which failures count as "may
have reached broker A" was corrected by measurement during the walk (Commands, `send`): only a failure
identified as happening before the connection leaves broker A untouched.
Rejected:
- (a) Not sent, no trace. In a scheduled job the one exit 1 goes unseen, `report` stays silent, and
  broker A was never asked.
- (b) `sent` without a reference. A rejected submission would start a deadline broker A never had, a
  month later `report` would call it overdue, and the human could file a complaint (D-1) about a
  request broker A never had.
- Asking the human on the spot. `send` runs in scheduled jobs and agent tool calls, where nobody can
  answer.

Consequence: `report` also lists submissions without a receipt, which widens D-11 (recorded there).
Two gaps in this answer, found in review afterwards, are D-15 (resolved: `receipt` without a reference,
and `discard`) and D-16 (resolved: a re-send's receipt dates the request from
`dates.submitted`, as `receipt` does).

The sheet as walked:

- **What it decides.** The ledger state, the output and the exit code after a confirmed send that
  reached broker A, or may have, but yielded no receipt reference. The cases: a timeout; a non-2xx
  status, including any redirect (Submission: none is followed); a response over 1 MB; a 2xx response
  that still contains the form; a 2xx response in which `receipt.selector` and
  `receipt.reference_pattern` find no reference; and any failure not positively identified as
  happening before the connection was made (`ENOTFOUND`, `ECONNREFUSED`), because only the cause code
  tells a refused connection from a reset after sending (Commands, `send`). A failure identified as pre-connection is not
  one of them: nothing reached broker A, and the entry stays `drafted`. On it hang: whether every
  `sent` entry has a `reference`, whether a `receipt` command is needed, and whether `report` shows
  attempts without a receipt.
- **The facts that constrain the options.**
  - Each case is ambiguous. A timeout may come after broker A stored the request. A 303 redirect is
    how many forms say "thank you". A 4xx or 5xx probably means the request was not taken, but
    privacy-guard cannot know. A 2xx without a reference may be a changed thank-you page or a 200 error
    page. The response is untrusted content, so privacy-guard cannot read more into it than the
    selector, the pattern and the form check.
  - A response that still contains `form.selector` is the form coming back, not a thank-you page; on
    broker A's page the hidden `BA-000000` would match the pattern anyway (line 71).
  - `sent` starts the deadline (GLOSSARY, Sent), and `report` turns a `sent` request into an overdue
    one a month later. A `sent` entry for a request broker A never took produces a false overdue, and
    a complaint (D-1) the human may file on it.
  - A second submission gives broker A two requests from the subject. Whether broker A then treats the
    second as starting a new month is unknown. Neither is verified.
  - `send` runs in scheduled jobs and agent tool calls, where an exit code printed once may go unseen;
    `report` exit 1 is the channel that keeps saying something (D-11).
  - Each confirmed send uses up the human's marker (hook line 78), so any retry needs a new approval.
- **Options.** Common to all: a 2xx response that still contains `form.selector` counts as no receipt,
  whatever the pattern finds; and the message names the case (timeout, status, over the cap, form
  returned, no reference), never the page's text.
  - **(a) Not sent.** The entry stays `drafted`; `send` prints "the request to broker-a may or may not
    have arrived (<case>). Check broker A's mail before sending again." and exits 1. Costs: nothing
    new. Failure mode: the attempt leaves no trace; in a scheduled job the one exit 1 goes unseen, the
    entry sits `drafted`, `report` says nothing, and the request silently never proceeds. A second:
    if it did arrive, a re-send gives broker A two requests. Degrades: when broker A changes its
    thank-you page, no send succeeds until the playbook is fixed. Still works: draft, the dry run,
    report on other requests, the deadline (it never starts falsely).
  - **(b) Sent without a reference.** The entry becomes `sent` with `dates.sent` and `dates.due` and no
    `reference`; `send` warns and exits 1. `receipt <broker> <reference>` records the reference by hand
    later, for example from broker A's confirmation email. Costs: one command, and `report` and D-1
    must handle a `sent` request with no reference. Failure mode: broker A never took the request, and
    a month later `report` calls it overdue; the human may complain about a request broker A never
    had. Degrades: a changed thank-you page makes every send look successful but unconfirmed. Still
    works: draft, report, the deadline whenever the request did arrive.
  - **(c) Attempt recorded, not sent.** The entry stays `drafted` and gains `dates.submitted`; `send`
    exits 1 with (a)'s message. `report` lists it every day ("broker-a: submitted 2026-10-12, no
    receipt") and counts it toward exit 1. A later `send` of that entry, dry run or confirmed, first
    prints "a submission on 2026-10-12 got no receipt; check broker A's mail before sending again". Two
    ways out: a re-send that gets a receipt (`sent` from that day), or `receipt <broker> <reference>`
    when broker A's mail shows the first one arrived (`sent` from `dates.submitted`, with its due date).
    Costs: one date field, one `report` line, one warning, one command. Failure mode: the human
    re-sends without checking and broker A has two requests, but only after a warning. Degrades: a
    changed thank-you page makes every send land in `report` as "no receipt", loudly. Still works:
    everything; the deadline never starts without a receipt or the human's word.
  - Rejected: asking the human on the spot (`send` runs in scheduled jobs and agent tool calls, where
    nobody can answer a prompt).
- **Proposal (as walked; chosen).** (c). Like (a) it never starts a false deadline; unlike
  (a) the failed attempt stays loud in `report` until the human resolves it, and a re-send is a
  choice made after a warning, not by accident.
- **Worked example.** 2026-10-12, `send broker-a --confirm` gets 200 with a page whose `#thanks` reads
  "Thank you. We will be in touch." and no reference.
  - (a): entry stays `drafted`, exit 1, nothing else. The scheduled job's log is not read; on
    2026-11-13 `report` says "nothing is overdue" and nobody knows broker A was never asked.
  - (b): entry `sent`, due 2026-11-12, no reference. Broker A had in fact rejected the submission;
    `report` on 2026-11-13 flags an overdue request broker A never had.
  - (c): entry `drafted` with `submitted: 2026-10-12`; `report` exits 1 from 2026-10-12 on. On
    2026-10-13 the human finds broker A's email confirming `BA-482915` and runs
    `privacy-guard receipt broker-a BA-482915`: `sent` 2026-10-12, due 2026-11-12. Had there been no
    email, a new marker and `send broker-a --confirm` would have sent it again, after the warning.
- **Impact.** (a): item 7 only. (b): item 7, a `receipt` command in item 8, and a `report` rule for a
  `sent` entry without a reference. (c): item 7 (`dates.submitted`, the warning, the `report` line,
  since item 7 adds the field), a `receipt` command in item 8 and a glossary term, **Submitted**.
- **Interacts with.** D-3 (a receipt is not a reply), D-4 (how the response is read), D-9 (what is
  recorded by hand), D-11 (`report` output and exit), D-1 (resolved: the human files any complaint;
  `escalate` records it), D-16 (which date a re-send carries).

### D-15: How does a submission that never gets a receipt end?

**RESOLVED 2026-10-12 with the user: option (c), both exits.** `receipt <broker> [reference]` records
that the submission arrived, with or without a reference, and `discard <broker>` removes the entry of
an attempt that did not arrive or is withdrawn. The user's reason: each command records what they
actually know. Either ends the daily red line in `report`; a duplicate send is no longer the only way
out. A `sent` entry may therefore lack a `reference`, on the human's word. `discard` accepts only a
`drafted` entry with `dates.submitted`, so it cannot remove a `sent` request or a plain `drafted` one.
Rejected:
- (a) `receipt` with an optional reference alone. "Rejected" and "withdrawn" would still have no
  exit except a duplicate send.
- (b) `discard` alone. "It arrived without a reference" would have no exit except discarding it and
  sending again, which gives broker A a second request.
- No exit. `report` would stay red every day or broker A would get a second request.

The sheet as walked:

- **What it decides.** D-14 left a `drafted` entry with `dates.submitted` two exits: a send that gets
  a receipt, and `receipt <broker> <reference>`. Neither fits a submission whose receipt will never
  come: broker A's mail carries no reference, the human learns it was rejected, or the human no
  longer wants the request. `draft` refuses while the entry is open (D-8) and `reply` refuses a
  `drafted` entry (D-9), so the only exit left is a duplicate send, and `report` exits 1 every day
  until then. On it hang: whether `receipt` may take no reference, whether a command abandons an
  attempt, and what the ledger keeps of it.
- **The facts that constrain the options.**
  - The user's reason for D-14: a failed send must stay visible until they resolve it. A red `report`
    with no honest exit is the opposite: it teaches the reader to ignore it.
  - `receipt` requires a reference matching `receipt.reference_pattern` and a `drafted` entry that
    has `dates.submitted` (Commands).
  - An open request blocks a new `draft` (D-8); `reply` takes only `sent` or `escalated` (D-9).
  - The ledger holds no personal data ([GLOSSARY.md](../../../GLOSSARY.md), Ledger), so a record of
    an abandoned attempt could hold the broker, the state and dates only.
  - A `sent` entry without a `reference` is already possible: `loadLedger` does not require one and
    item 2's `report` works on a hand-written ledger.
- **Options.**
  - **(a) `receipt <broker>` with the reference optional.** "It arrived; broker A gave me no
    reference." Sets `sent` as `receipt` does, with no `reference`. Costs: a `sent` entry may lack a
    reference, on the human's word only. Failure mode: the human says it arrived when it did not, a
    deadline starts that broker A never had, and a month later `report` calls it overdue. Degrades:
    nothing in the ledger beyond a missing reference. Still works: everything else. Does not cover
    "rejected" or "I withdraw it".
  - **(b) `discard <broker>`.** Removes the broker's `drafted` entry that has `dates.submitted` and
    prints what it removed (broker, drafted and submitted dates). Costs: one command; the ledger
    forgets the attempt. Failure mode: the human discards an attempt that did arrive, broker A holds
    a request nothing tracks, and a later `draft` and send makes a duplicate. Degrades: the history
    of the attempt is gone. Still works: everything else. Does not cover "it arrived without a
    reference".
  - **(c) Both (a) and (b).** Costs: both commands. Failure modes: both of the above, each limited to
    the human's explicit word. Covers all three situations.
  - Rejected: no exit. A duplicate send is the only way out: `report` stays red, or broker A gets a
    second request.
- **Proposal (as walked; chosen).** (c). The two exits record two different truths ("it
  arrived" and "it did not, or I withdraw it"), each a deliberate command of the human, and each ends
  the daily red line honestly.
- **Worked example.** 2026-10-12 a send got a 200 page without a reference; on 2026-10-13 broker A's
  mail says it has the request and gives no reference.
  - (a) or (c): `privacy-guard receipt broker-a` records `sent` 2026-10-12, due 2026-11-12, no
    reference; `report` is quiet.
  - (b) alone: not possible; the human can only `discard` and send again, and broker A gets a second
    request.
  - If broker A's mail had said the form was rejected: (b) or (c): `discard broker-a`, then `draft`
    and a confirmed send again.
  - Neither: `report` is red every day, or the duplicate goes out.
- **Impact.** Item 8 (`receipt` with an optional reference; `discard`), the Commands table and
  `receipt` text, `test/cli.test.ts`. No file outside the CLI.
- **Interacts with.** D-14 (the exits it left), D-9 and D-8 (what `reply` and `draft` refuse), D-16
  (a re-send also ends a submission), D-1 (resolved: `escalate` accepts only overdue `sent` requests, so
  one without a reference can be escalated).

### D-16: Which date does a re-send's receipt carry when an earlier attempt is on record?

**RESOLVED 2026-10-12 with the user: option (b), from the first attempt.** A re-send that gets a
receipt, for an entry that has `dates.submitted`, sets `dates.sent` to `dates.submitted` and
`dates.due` to `dueDate(dates.submitted)`, as `receipt` does; `dates.submitted` stays on the entry.
An entry with no `dates.submitted` takes today. The user's reason: an early flag they can check
beats a late one they never see. Cost accepted: if the first attempt had not arrived, `report` calls
the request overdue up to a month early, and the human reviews it before any complaint (D-1).
Rejected:
- (a) From the re-send's day. If the first attempt had arrived, `report` flags the request up to a
  month later than the law allows, and nobody sees it.
- (c) Two dates (`sent` today, due from the first attempt). The same early flag as (b), and due is no
  longer a month after sent, which `dueDate`'s tests and the readers assume.

The sheet as walked:

- **What it decides.** D-14 turns a `drafted` entry `sent` "from that day" when a re-send gets a
  receipt, while `receipt` dates the request from `dates.submitted`, the first attempt, on D-6's
  reading. If the first attempt had in fact arrived, the two give different due dates: the re-send's
  receipt proves only that the second one did. On it hang: `dates.sent` and `dates.due` after a
  re-send, and whether `dates.submitted` stays on the entry.
- **The facts that constrain the options.**
  - D-6, the user's: one calendar month after the sent date, "never later than the law allows".
    Article 12(3) runs from the controller's receipt of the request: the first one, if it arrived.
  - `receipt` takes `dates.sent` from `dates.submitted` (Commands, `receipt`).
  - A re-send's receipt says nothing about the first attempt. Whether broker A treats a duplicate as
    a new request is unknown.
  - `report` exits 1 for an overdue `sent` request, and under D-1 (b) a human reviews it before any
    complaint.
  - `loadLedger` validates every `dates.*` as an ISO date (`src/ledger.ts` lines 42-44), so keeping
    `submitted` on a `sent` entry needs no new rule.
- **Options.**
  - **(a) From the re-send's day (as walked in D-14).** `dates.sent` = today, due a month from today;
    `dates.submitted` stays as a record. Costs: nothing new. Failure mode: if the first attempt had
    arrived, the due date is up to a month later than the law allows and `report` flags the request
    late, never a premature complaint. Differs from `receipt` and from D-6's reading. Degrades:
    promptness of the flag. Still works: everything else.
  - **(b) From the first attempt.** `dates.sent` = `dates.submitted`, due from it, as `receipt`
    does. Costs: "sent" names a day on which broker A may have got nothing. Failure mode: if the
    first attempt had not arrived, the due date is up to a month early and `report` calls the
    request overdue before broker A's month ends; a human reviews it before any complaint. Matches
    D-6 and `receipt`. Degrades: a possible early flag. Still works: everything else.
  - **(c) Two dates.** `dates.sent` = today (the receipt in hand), `dates.due` a month from
    `dates.submitted`; `report` prints "sent 2026-10-14, due 2026-11-12". Costs: due is no longer a
    month after sent, which `dueDate`'s tests and the readers assume. Failure mode as (b).
- **Proposal (as walked; chosen).** (b). One rule for both exits (`receipt` and a re-send),
  consistent with D-6, and a failed first attempt costs at worst an early flag that a human reviews.
- **Worked example.** 2026-10-12 a send timed out (`submitted` 2026-10-12); on 2026-10-14 the human
  re-sends and gets `BA-482915`.
  - (a): sent 2026-10-14, due 2026-11-14. If broker A had the first one, its month ended on
    2026-11-12: `report` flags it from 2026-11-15, two days late.
  - (b): sent 2026-10-12, due 2026-11-12. If broker A had not got the first one, its month ends on
    2026-11-14: `report` flags it from 2026-11-13, two days early.
  - (c): sent 2026-10-14, due 2026-11-12, the same flag day as (b).
- **Impact.** Item 7 (the success path of a re-send, with tests for both cases), the `send` bullet
  in Commands, and the D-14 sheet's "`sent` from that day", which stays as the record of what was
  walked.
- **Interacts with.** D-6, D-14, D-15, D-1 (resolved: `escalate` acts on the recorded due date).

### D-1: What happens after a request becomes overdue?

**RESOLVED 2026-10-12 with the user: option (b) with (b3), the human files; `escalate` records it;
`report` stays red until a reply.** privacy-guard files no complaint and sends nothing after a
request is overdue. `escalate <broker> [YYYY-MM-DD]` records `state: "escalated"` and
`dates.escalated` on the broker's overdue `sent` request, and refuses any other. `report` lists an
`escalated` request ("broker-a: escalated 2026-11-16, no reply") and exits 1 every day until `reply`
records one; `due` keeps listing it. The user's reason: a complaint to the authority cannot be
unsent, so a human files it, and a stalled escalation must stay visible. The fatigue (no snooze,
red until a reply) is accepted.
Rejected:
- (a) privacy-guard files the complaint. A complaint filed while a valid extension runs is premature
  and irreversible, nothing in the ledger shows the extension, and it needs an authority playbook,
  fixture and subject field each.
- (b1) Nothing for an escalated request. A stalled escalation would show nowhere.
- (b2) `due` lists it, `report` does not. A scheduled `report` never sees it; `due` exits 0.
- (c) Ask the broker again first. It needs new `draft` and `send` rules, a second date and an
  invented grace period, and broker A may treat a second submission as a new request that restarts
  its month.
- Doing nothing. The request would be red every day with no way to record that the human acted.

The sheet as walked:

- **What it decides.** What privacy-guard does, if anything, once `report` lists a request as
  overdue: escalate to a supervisory authority itself, leave the next step to the human and record
  it, or first ask the broker again. On it hang: whether `escalated` gets a command that sets it and
  what that command accepts; whether a second kind of outward send is needed; and what `report`
  shows for an `escalated` request. The last also decides the lines in this PRD that name
  `escalated` (an open request, `reply` accepting it, the overdue rule): with no `escalate` command
  they go. Nothing else waits on it: draft, send, receipt, reply and report ship under any answer.
- **The facts that constrain the options.**
  - GDPR Article 12(3): the broker must act within one month of receipt; that period "may be extended
    by two further months where necessary", provided the broker tells the subject within the first
    month (checked against gdpr-info.eu this session). Handling an extension is out of scope here
    (Scope, Later), so privacy-guard cannot tell a request with a valid extension from one that is
    simply late; both look overdue.
  - GDPR Article 77(1): the subject may complain to a supervisory authority, "in particular in the
    Member State of his or her habitual residence, place of work or place of the alleged
    infringement" (same check). Which authority is right depends on the subject, so it is subject
    data, not playbook data, and no file holds it today.
  - A complaint or a second submission is an outward send. review-checks: "Nothing is sent without a
    confirmed send". The hook's marker is one-shot (`deny-outward-send.sh` lines 16-18, 78), and D-13
    makes one confirmed send one message.
  - A complaint carries personal data (who complains, about which request); the ledger may not hold it
    ([GLOSSARY.md](../../../GLOSSARY.md), Ledger) and nothing may log it.
  - `escalated` already exists as a stored state (`src/ledger.ts` line 8) but nothing sets it, and
    `dates` has no `escalated` field (line 17). `dueOn` excludes only `acknowledged` (line 56), so `due`
    keeps listing an `escalated` request whose due date has passed; `due` returns 0 whatever it lists
    (`src/cli.ts` lines 31-39).
  - `report` exits 1 for an overdue `sent` request, a `sent` request without a due date, and (D-14) a
    submission without a receipt: the user's reason for D-14 is that a failure must stay visible until
    they resolve it.
  - `draft` refuses while any request of the broker is open (D-8), and `sent` and `escalated` are
    open. `send` takes only a `drafted` entry (D-13). `reference` is one string, and `dates.submitted`
    means an unresolved attempt on a `drafted` entry (D-14).
  - The only channel after this PRD is broker A's web form. It has no free-text field (lines 44-68), and
    broker A's page refuses email and post (line 32). privacy-guard therefore has no way to write
    broker A a letter: anything it sends broker A is another submission of the same form.
  - Authorities typically take complaints through their own web forms (not verified per authority).
    The `web-form` channel exists, but each authority's form would need its own playbook, fixture and
    contract test.
- **Options.**
  - **(a) privacy-guard escalates to the supervisory authority.** It drafts an Article 77 complaint and
    submits it, still as a confirmed send, then sets `escalated`. Costs: complaint content; a new
    subject field (the authority); a playbook, fixture and contract test per authority; a second
    confirmed send per request; `subject.yaml` read by more than `draft` and `send`, and the masking
    rules extended to the complaint. Failure mode: a complaint filed while a valid extension runs
    (Article 12(3)) is premature, and nothing in privacy-guard can see the extension; being
    automatic it looks correct and is an irreversible outward write. Degrades: nothing when it
    works; when an authority changes its form, every escalation to it fails until its playbook is
    fixed. Still works: draft, send, report. Without the confirmed send it would break the first
    review check, so "automatic" can only mean "drafted automatically".
  - **(b) Queue it for the human.** `report` keeps flagging the request; the human decides (wait for
    a claimed extension, contact the broker, complain to the authority) and does it outside
    privacy-guard; `privacy-guard escalate <broker> [YYYY-MM-DD]` records `state: "escalated"` and
    `dates.escalated` on an overdue `sent` request, and refuses any other (not overdue, `drafted`,
    `acknowledged`, already `escalated`), naming why; its date follows `reply`'s rules (a real
    date, not after today, not before `dates.sent`). Costs: one small command and one date field. It
    leaves broker A's mail, and the decision, with the human. What `report` shows for an
    `escalated` request is a sub-choice:
    - **(b1) Nothing.** The request leaves `report`, and `dueOn` skips `escalated`, so `due` is
      quiet too. Failure mode: a stalled escalation shows nowhere. Still works: everything else.
    - **(b2) Nothing in `report`; `due` keeps listing it.** `due` always exits 0 and a scheduled job
      that runs `report` never sees it. Failure mode: the stall is visible only to someone who runs
      `due`.
    - **(b3) A line in `report` and exit 1 until `reply`.** "broker-a: escalated 2026-11-16, no
      reply". One rule: `report` exits 1 while any request past its due date is unresolved, and only
      `reply` ends it. Failure mode: fatigue. A claimed extension can add two months, and an
      authority takes longer; `report` is red every day with no way to snooze it, which teaches
      the reader to ignore real overdue lines.
  - **(c) Ask the broker again first, then escalate.** privacy-guard submits broker A's form a second
    time (confirmed send), records it, and escalates by (a) or (b) when that too goes unanswered.
    Costs: `draft` refuses on the open `sent` request and `send` takes only `drafted` entries, so a
    second submission needs new rules for both; `dates.submitted` already means an unresolved attempt
    on a `drafted` entry, so a reminder needs another date; `reference` is one string, so broker A's
    second reference overwrites the first or `reference` becomes a list; and a grace period after it
    that the GDPR does not define, so privacy-guard would invent a number. Failure mode: broker A's
    form cannot say "this is a reminder", so broker A sees a new request with a new reference and may
    treat it as starting a new month; and the invented grace period reads like a legal deadline and
    delays the complaint the law already allows. Degrades: as (a) or (b) at the end. Still works:
    everything before the second submission.
  - Rejected: doing nothing after `report`. The request would stay in `report` with exit 1 every day
    and nothing could record that the human acted, so `escalated` and the lines that name it would be
    dead, against the user's own reason in D-14.
- **Proposal (as walked; chosen).** (b) with (b3). It keeps every outward write a confirmed
  send of content the human chose, leaves the extension question with the only party who can see it,
  and costs one command. (b3) gives `report` one rule that matches D-14's reason; the fatigue is its
  price, paid until the human records a reply. (a) can be added later as a draft helper on top of (b)
  without changing the states.
- **Worked example.** Sent 2026-10-12 with receipt `BA-482915`, due 2026-11-12, no reply; `report` on
  2026-11-13 prints `broker-a: sent 2026-10-12, due 2026-11-12, 1 day overdue` and exits 1.
  - (a): privacy-guard drafts a complaint to the authority of the subject's residence, citing
    `BA-482915` when the ledger has one, and prints it; the human reviews it and runs the confirmed
    send. If broker A had told the subject on 2026-11-02 that it extends to 2027-01-12, the
    complaint is premature and already filed; nothing in the ledger showed the extension.
  - (b): the human reads broker A's mail, sees no extension, files a complaint on 2026-11-16, then
    runs `privacy-guard escalate broker-a 2026-11-16`. `report` on 2026-11-17: under (b1) and (b2)
    no line and exit 0 (if nothing else is overdue); under (b3) `broker-a: escalated 2026-11-16, no
    reply` and exit 1, every day until `privacy-guard reply broker-a <date>`. `due` lists
    `broker-a: escalated, due 2026-11-12` under (b2) and (b3), and nothing under (b1).
  - (c): privacy-guard resubmits the form on 2026-11-13 and broker A answers `BA-731004`, a new
    request as far as broker A can tell; with a made-up 14-day grace period the escalation waits until
    2026-11-27, two weeks the law did not ask for, and broker A may argue its month runs to 2026-12-13.
- **Impact.** (b): `src/ledger.ts` (`dates.escalated`; `dueOn` under (b1)), `src/cli.ts` (`escalate`
  command, usage line 12, `report` under (b3)), a row in the Commands table, an **Escalated** term in
  [GLOSSARY.md](../../../GLOSSARY.md) (Overdue's wording, "a sent request with no reply", fits an
  escalated one too), item 10's README, `test/cli.test.ts`, and `test/ledger.test.ts` under (b1).
  (a): additionally complaint content, a subject field, a playbook with a fixture per authority, and
  an authority is not a Broker in the glossary's sense. (c): additionally a date and a rule change
  for `draft` and `send`, and a grace-period setting. Every option edits `src/cli.ts`: sequence D-1's
  ticket after item 8.
- **Interacts with.** D-14 (resolved: a `sent` entry written by `send` has a `reference`; a re-send
  is a confirmed send like any other and shares (c)'s question whether it restarts broker A's
  month), D-15 (resolved: `receipt` may write a `sent` entry with no `reference`, so `escalate` and
  any complaint text cannot assume one; `discard` removes only a `drafted` entry, never a request
  `escalate` could act on), D-16 (resolved: a re-send carries the first attempt's date; D-1 does not depend on it), D-8 (an open `escalated` request blocks a new `draft` until `reply`,
  which matters for `cadence`), D-10 (`escalated` stays a stored state, `overdue` does not), D-11
  and D-14 (what `report` prints and when it exits 1), D-4 and D-13 (confirmed send, one message per
  approval, for any complaint or second submission), the Article 12(3) extension (Later), `cadence`
  re-requests (Later).

### D-2: Which channel does broker A take requests on?

**RESOLVED 2026-10-12 by the user: broker A's web form, as its playbook already says.** Broker A's
own page is the evidence: "Fill in the form below. ... Requests sent by email or post are not
accepted." (`sites/broker-a/index.html` lines 31-32), followed by the form (lines 44-68). The saved
fixture `test/fixtures/broker-a-form.html` is the same page byte for byte, and the playbook
(`brokers/broker-a.yaml` lines 1, 8) and the intake (issue #2) agree. `channel: web-form` stays the
only channel; the fixture and the contract test stay.
Rejected: email to `privacy@broker-a.example`. The only support for it was a recollection that the
subject had received mail from that address, and an address a broker writes from is not one it takes
requests at. Broker A's page refuses email outright, so a request by email would start a deadline
broker A never accepted, and nothing in the repo could show otherwise.

### D-3: Is the broker's confirmation of getting a request a reply?

**RESOLVED 2026-10-12 with the user: no; it is a receipt, and only a reply makes a request
`acknowledged`.** A receipt (broker A's thank-you page with a reference such as `BA-482915`) proves the
form was taken, not that broker A acted; counting it as a reply would stop the deadline on the day of
sending. So the playbook block that finds the reference moves from `reply.acknowledged_when` to
`receipt`, and finding it records `reference`, not `acknowledged`.
Rejected: keeping `acknowledged` for a receipt (the deadline would mean nothing).

### D-4: How does `send --confirm` deliver?

**RESOLVED 2026-10-12 by the user, in the review session: an HTTP POST of the playbook's fields to the
form's address, the receipt reference read from the thank-you response; no redirects followed, a
10-second timeout, a 1 MB response cap.** No browser is driven: the form submits without script (line
44: `method="post"`, no `enctype`), and the page's script (lines 76-84) only fakes a reference in the
browser. The dry run prints the full submission, so the human approves exactly what goes out. The send
stays behind `--confirm` and the hook's marker (hardened, item 6). On a receipt: `sent`, `dates.sent`
today, `dates.due` computed (D-6), `reference` stored. The details are in Submission and Receipt.
Rejected:
- A prepared request for the human to submit by hand (raised in issue #2's triage notes: "automated
  submission or a prepared request for a human to submit"). The human would type the subject's data
  into the form and copy the reference back, so the receipt, and with it the deadline, would rest on a
  manual step the ledger cannot check.
- A headless browser. It adds a heavy dependency and runs the broker's script, which is untrusted
  content, to submit a form that needs no script.
- Following redirects. `fetch` would post the subject's fields again on a 307 or 308, possibly to
  another origin; a redirect is handled as no receipt instead (D-14).

### D-5: Where does the subject's data live?

**RESOLVED 2026-10-12 with the user: a git-ignored `subject.yaml`, with a committed
`subject.example.yaml` holding the made-up test subject.** `phone` and `job_title` are optional. The
file is read only at draft and send and never copied into the ledger or logs. Every value is a YAML
string (decided by the user in the review session; Subject file). Rejected: the ledger (GLOSSARY: it
holds no personal data) and the playbook (one broker's data, not the subject's).

### D-6: How is the due date computed?

**RESOLVED 2026-10-12 with the user: one calendar month after the sent date, clamped to the last day of
the target month.** 31 January gives 28 or 29 February; 31 August gives 30 September. The user chose
the conservative reading: never later than the law allows. Rejected: 30 days (review-checks: deadlines
are calendar months); rolling over into the next month (2026-01-31 to 2026-03-03, later than the law
allows).

### D-7: What does a request to broker A contain?

**RESOLVED 2026-10-12, confirmed by the user in the review session: the form's fields, filled from
`subject.yaml` through the playbook's placeholders; no letter template.** `request_type: both` asks
for erasure (Article 17) and objection (Article 21) in broker A's own terms (lines 58-61). The
renderer is shared by every web-form playbook.
Rejected: a shared letter template (`templates/request.md`), which the grilling had chosen when it
assumed broker A took email. Broker A's form has no free-text field to carry it, so it would never be
sent; it waits for a broker that takes letters.

### D-8: What does `draft` store?

**RESOLVED 2026-10-12 with the user: a ledger entry `drafted` with broker and date only; the rendered
fields are printed, not stored, and `send` renders them again.** `draft` refuses when the broker
already has an open request. Storing the fields would put personal data in the ledger. The printed
fields are masked unless `--show` (decided by the user in the review session; Field rendering).

### D-9: How are a receipt and a reply recorded?

**RESOLVED 2026-10-12, confirmed by the user in the review session: the receipt by `send`, from broker
A's thank-you response (D-4); the reply by hand, with `reply <broker> [YYYY-MM-DD]`.** The reference
is broker A's, not personal data, so the ledger may hold it. A `receipt <broker> [reference]` command and a `discard <broker>` command
also exist, only for a submission that yielded no receipt (D-14, D-15). Reading the inbox for replies is
Later.
Rejected: recording every receipt by hand with `receipt <broker> <reference>`, which the grilling had
chosen when it assumed broker A took email. Broker A's thank-you page carries the reference, so typing
it in again adds a step that can be skipped or mistyped.

### D-10: Is overdue a stored state?

**RESOLVED 2026-10-12 with the user: no; it is derived at read time.** Overdue: sent, no reply, today
strictly after the due date; on the due date itself not yet overdue. `overdue` leaves `STATES`;
`escalated` stays: `escalate` sets it (D-1). A stored `overdue` would go stale the moment a reply is recorded or a date
corrected, and nothing writes it today.

### D-11: What does `report` show and return?

**RESOLVED 2026-10-12 with the user: only overdue requests (broker, sent date, due date, days overdue);
exit 1 when anything is overdue, 0 otherwise, so a scheduled job notices.** `due` stays as it is
(entries due on or before today). Widened 2026-10-12 by the user's answer to D-14: `report` also
lists, and exits 1 for, a submission without a receipt (a `drafted` entry with `dates.submitted`), so a
failed send stays visible.

### D-12: Is there an existing request to backfill?

**RESOLVED 2026-10-12 with the user: no.** The subject's earlier exchange with broker A answered a
general question; it was not a request. Nothing to record.

### D-13: How much does one confirmed send send?

**RESOLVED 2026-10-12 by the user, in the review session: one message to one broker per approval.
`send` takes the broker, `send <broker> [--confirm]`, and sends only that broker's single `drafted`
request; the hook lets one approval through one command (item 6).** The hook's marker is used up once
per tool call (`deny-outward-send.sh` line 78), so both the command and the hook must bound what one
approval reaches. `draft` already allows one open request per broker (D-8); `send` refuses a
hand-edited ledger with two `drafted` entries for the broker. The form matches the hook's self-test,
`npx privacy-guard send --confirm broker-a` (line 114).
Rejected:
- `send` without a broker, refusing a confirmed send when more than one entry is `drafted`. One
  approval's reach would then depend on ledger contents the human did not look at when approving, and
  a second broker would make `send` refuse until each was sent separately anyway.
- `send` without a broker, sending every `drafted` entry (the skeleton's behaviour, `src/cli.ts` lines
  42-56). One approval would reach every broker with a draft.

## Implementation plan

Each item is one ticket, sized for one session. Items 2, 3, 4, 7 and 8 edit `src/cli.ts` or
`src/ledger.ts`, so they land one at a time in the order given; items 1, 5 and 6 touch neither and can
land beside them. The blocking edges below are the ones the design forces. An item that changes an
existing assertion names it, which is the tester agent's authority once this PRD is in `reviewed/`.

- [x] **1. Playbook: `receipt`, validation, a stronger contract test.** [#7](https://github.com/KenKor/privacy-guard/issues/7) Follows D-2, D-3, D-7. In
  `brokers/broker-a.yaml`, move `reply.acknowledged_when` to `receipt` as in Playbook above. In
  `src/playbook.ts`, `Playbook.receipt` replaces `reply.acknowledged_when`; `parsePlaybook` requires
  `receipt.selector` and `receipt.reference_pattern` for `channel: web-form`, requires the pattern to
  compile, and requires `form.fields` values to be strings or booleans. New tests in
  `test/playbook.test.ts`, each naming the file and field in the error: a web-form playbook missing
  `form.url`, `form.fields`, `receipt.selector` or `receipt.reference_pattern` is rejected; a
  `reference_pattern` that does not compile is rejected; a field value that is a list is rejected. New
  checks in `test/broker-a-form.test.ts`, against the fixture: the form's `action` resolved against
  `form.url`, without fragment, equals `form.url`; every control the form marks `required` has a
  playbook field; a field whose control is a `select` has one of its option values; a boolean field's
  control is a checkbox without a `value` attribute. Assertion changed in `test/broker-a-form.test.ts`:
  lines 25-27 ("finds the acknowledgement element" reads `playbook.reply.acknowledged_when.selector`;
  it becomes "finds the receipt element" reading `playbook.receipt.selector`). The assertions in
  `test/playbook.test.ts` lines 18-19 and 24 stay. Blocked by: none.
- [ ] **2. Overdue derived; `report` command.** [#8](https://github.com/KenKor/privacy-guard/issues/8) Follows D-10, D-11. Remove `overdue` from `STATES`;
  add an overdue query (state `sent`, due date set, `today > due`) and days overdue; add `report` with
  the output and exit codes in Commands, including the warning for a `sent` entry without a due date
  but not the line for a submission without a receipt, which needs `dates.submitted` and arrives with
  item 7.
  In `.claude/agents/tester.md`: line 43's state machine becomes "drafted, sent, acknowledged,
  escalated", with overdue named as derived; line 56's send tier becomes "test the send path against a
  local stub (an injected `deliver`, or the local site on a free port), never a real broker" instead
  of "in dry-run". Assertion changed: `test/ledger.test.ts` line 52 (the `past-due` fixture's state
  `overdue` becomes `sent`; the `dueOn` expectation on line 60 stays). Works on a hand-written ledger.
  Blocked by: none.
- [ ] **3. Due date arithmetic.** [#9](https://github.com/KenKor/privacy-guard/issues/9) Follows D-6. `dueDate(sent)` in `src/ledger.ts` with the table in
  Due date and overdue as tests, including both leap and non-leap February; update the comment on
  `src/ledger.ts` line 3. Blocked by: none.
- [ ] **4. Subject file, field rendering, `draft <broker>`.** [#10](https://github.com/KenKor/privacy-guard/issues/10) Follows D-5, D-7, D-8. `subject.example.yaml`
  with the made-up subject; `subject.yaml` in `.gitignore`; the subject loader, refusing a non-string
  value; the renderer with `| optional`, `true` as `on`, `false` left out, and named failures; the
  masked printing with `--show`; `CliEnv` gains `brokersDir` and `subjectPath` (Test seams); `draft
  <broker>` as in Commands. Tests: a subject without `phone` sends `phone` empty; a subject without
  `email` fails naming `email` and no value; an unquoted number for `phone` is refused naming `phone`;
  an unknown placeholder fails naming it; `draft` output contains no subject value without `--show`
  and all of them with it. In review-checks, point "Use the made-up subject in `test/fixtures/`" at
  `subject.example.yaml` (no such subject exists in `test/fixtures/` at `66295b1`), and make the
  confirmed-send line say the marker applies to an agent's tool calls (Guarding the send). Add
  **Open request** to GLOSSARY.md. Assertion changed: `test/cli.test.ts` lines 66-70 ("draft says it
  is not implemented yet"). Blocked by: 1.
- [ ] **5. The local site answers the form's POST.** [#11](https://github.com/KenKor/privacy-guard/issues/11) As in The local site. `sites/broker-a/server.ts`
  (`startSite(port)`) and `sites/broker-a/main.ts`; `npm run site` runs `main.ts`; `sites` added to
  `tsconfig.json` `include`. `index.html` and the fixture do not change. Tests in
  `test/broker-a-site.test.ts`, with the server started in-process on a free port (an agent's `curl`
  POST is denied by the hook, by design): GET `/` and `/index.html` return `index.html`; another path
  returns 404; a valid POST returns 200 with a `BA-` reference that is not `BA-000000` and no
  `form#opt-out-form`; a POST missing `confirm_identity` returns 400 with no reference; the thank-you
  page carries the hidden notice. Blocked by: none.
- [ ] **6. Harden the send hook.** [#12](https://github.com/KenKor/privacy-guard/issues/12) Follows D-4, D-13. In `.claude/hooks/deny-outward-send.sh`: treat a
  send as outward however the CLI is run (`npx privacy-guard send`, `node bin/privacy-guard.js send`,
  `node src/cli.ts send`, `npm exec privacy-guard -- send`), and deny a tool call in which a send is
  not the only command: any `;`, `&`, `|`, newline, backtick or `$(` in a command line that contains a
  send, so one marker covers one command. Update the header comment to match. New self-test cases:
  each way of running is denied without the marker and allowed with `--confirm` and the marker; a
  chained send (`... send --confirm broker-a; ... send --confirm broker-b`) and a send in a loop are
  denied even with the marker; the existing cases (lines 110-126) still pass. Run
  `.claude/hooks/deny-outward-send.sh --selftest`. Blocked by: none. Item 7 must not merge before it.
- [ ] **7. `send <broker> --confirm` submits the form.** [#13](https://github.com/KenKor/privacy-guard/issues/13) Follows D-4, D-6, D-13, D-14, D-16.
  `send <broker> [--confirm] [--show]` with the refusals in Commands;
  `SendRequest` carries the address and rendered fields; `Deliver` returns the outcome; the HTTP
  `deliver` with `fetch`, form encoding, `redirect: "manual"`, the 10-second timeout and the 1 MB cap
  (Submission); the receipt read as in Receipt, including the form-still-present check; the no-receipt outcomes of
  Commands, `send`, with the warning on a send of an entry that has `dates.submitted`; `report` also
  lists such an entry; `reference?: string` on `LedgerEntry`, validated as a string by
  `loadLedger`, and `submitted?` among its `dates` (the existing date check covers it); on a receipt write `sent`, `dates.sent` (the entry's `dates.submitted` when it has one, else today), `dates.due`, `reference`;
  `CliEnv` gains `deliver`. Add **Submitted** to GLOSSARY.md. Move
  `node-html-parser` to `dependencies`. Tests: the CLI with an injected `deliver` for a receipt, a
  failure identified as pre-connection (entry stays `drafted`, no `dates.submitted`), each of D-14's
  cases (entry stays `drafted` with `dates.submitted`, exit 1, listed by `report`), a second failure
  that keeps the first date, a failure with no cause code (counts as may have reached broker A), the warning on a re-send, a re-send's receipt on 2026-10-14 for an entry submitted 2026-10-12 (sent 2026-10-12, due 2026-11-12) and the same with no submission (sent today), no broker, and no or two `drafted` entries; the HTTP `deliver` against the in-process site from item 5, including a redirect that is
  not followed and a response over 1 MB; a response that returns the form page with `BA-000000` yields
  no receipt; a response carrying the hidden notice yields only the reference; the dry run masks
  subject values without `--show`. Assertions changed in `test/cli.test.ts`: lines 45-50 (`send`
  without a broker now prints usage and exits 2), lines 52-57 ("would send to broker-a" becomes the
  printed submission, run as `send broker-a`), lines 59-63 (a confirmed send with a fake `deliver` now
  succeeds; the "not implemented yet" case is replaced by a failure identified as pre-connection
  that leaves the entry `drafted`), and the `guardedSend` tests at lines 80-94 (their `SendRequest` gains the address and
  fields). Blocked by: 2, 3, 4, 5, 6.
- [ ] **8. `reply`, `receipt` and `discard`.** [#14](https://github.com/KenKor/privacy-guard/issues/14) (`reply`), [#15](https://github.com/KenKor/privacy-guard/issues/15) (`receipt`, `discard`) Follows D-3, D-9, D-14, D-15. The commands with the
  refusals in Commands; usage line updated. Tests: `reply` takes the request out of `report`; `receipt` on a
  `drafted` entry with `dates.submitted` sets `sent`, takes the sent date from `dates.submitted` and
  the due date from it (2026-10-12 gives 2026-11-12), and takes it out of `report`; `receipt` refuses a
  broker with no submission, and a reference that does not match the pattern; `receipt` with no
  reference sets `sent` and leaves `reference` unset, and `report` is quiet afterwards. `discard`
  removes the broker's `drafted` entry that has `dates.submitted`, prints it, takes it out of
  `report`, and lets `draft` work again; it refuses a `sent` entry, a `drafted` entry with no
  submission, and a broker with no entry, naming which. `reply` needs only item 2 and can be sliced
  out ahead of item 7. Blocked by: 2, 7 (`receipt`, `discard`).
- [ ] **9. `escalate`.** [#16](https://github.com/KenKor/privacy-guard/issues/16) Follows D-1. `dates.escalated?` on `LedgerEntry` (the ISO-date check
  covers it). `escalate <broker> [YYYY-MM-DD]` as in Commands, with its refusals; `report` lists every
  `escalated` entry as "<broker>: escalated <date>, no reply" and exits 1 while one exists; `due`
  and `dueOn` stay unchanged. `GLOSSARY.md` gains **Escalated**. Usage line updated. Tests:
  `escalate` on an overdue `sent` entry sets `escalated` and the date; it refuses a `sent` entry on
  its due date (not overdue), a `drafted`, an `acknowledged` and an already `escalated` entry, a
  broker with no entry, and a date after today, before `dates.sent` or malformed; `report` lists an
  escalated entry and exits 1; `reply` takes it out and `report` exits 0; `due` still lists it; a
  `sent` entry with no `reference` can be escalated. Blocked by: 2, 8.
- [ ] **10. User docs.** [#17](https://github.com/KenKor/privacy-guard/issues/17) README: setting up `subject.yaml` (values quoted), running `npm run site`,
  the commands, `--show`, the confirmed send, what to do when a send gets no receipt (`receipt`, `discard`), running `report`
  on a schedule. For the `documenter`
  agent once 1 to 9 are merged. Blocked by: 1 to 9.

Test tiers: the unit tier in `test/` (`npm test`) covers items 1 to 8. The fixture tier stays for
broker A: `test/broker-a-form.test.ts` against `test/fixtures/broker-a-form.html`, strengthened by item
1. The send tier is the injected `deliver` and the in-process local site (items 5, 7). The hook has its
own self-test (item 6). No live tier: broker A's address is the local site.
