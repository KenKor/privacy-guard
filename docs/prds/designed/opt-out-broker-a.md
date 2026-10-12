# Opt out of broker A

**Issue:** #2

**Hook:** Ask broker A by email to erase the subject's data and stop selling it: `draft` the request,
send it only on a confirmed send over SMTP, record the receipt and the reply by hand, and have `report`
flag the request as overdue from the day after its due date (one calendar month after it was sent).

**Status:** designed, 2026-10-12. Written from a completed grilling session with the user. One
decision is open: D-1 (what happens after a request becomes overdue). D-2 to D-12 are resolved. Next:
`prd-reviewer`, then walk D-1, then `/to-tickets`. Code facts verified at `66295b1`.

## Purpose and background

privacy-guard asks data brokers to stop selling one person's data (GDPR Articles 17 and 21) and holds
each broker to the one-month deadline for its reply ([GLOSSARY.md](../../../GLOSSARY.md)). Issue #2
asks for the first end-to-end path: one broker, broker A, from draft to deadline. The user's
requirement for scope: "I want the deadline to mean something from day one." So the path ends not at
the send but at a command that says, without being asked twice, that broker A has missed its deadline.

The intake described broker A as taking requests through a web form. That is out of date (D-2):
broker A moved to email in September 2026, and the subject has had mail from
`privacy@broker-a.example`. The skeleton built for the web form is therefore partly replaced.

What the skeleton (`66295b1`) already has, and what this PRD builds on:

| Where | What is there now | What this PRD does with it |
|---|---|---|
| `src/cli.ts` | Commands `due`, `draft` (line 21: prints "draft is not implemented yet"), `send` (line 42, sends every `drafted` entry through `guardedSend`; `deliver` is `noChannel`, line 58, which throws) | Implements `draft` and `send`; adds `receipt`, `reply`, `report`; `due` unchanged |
| `src/send.ts` | `guardedSend(request, { confirm, deliver })`: returns `{ sent: false, reason: "dry-run" }` without `confirm`, else calls `deliver` (lines 12-19) | Keeps the guard; `deliver` becomes an SMTP channel; `SendRequest` (line 4, `{ broker }` only) carries the rendered message |
| `src/ledger.ts` | `STATES = ["drafted", "sent", "acknowledged", "overdue", "escalated"]` (line 8); `dates: { drafted?, sent?, acknowledged?, due? }` (line 17); line 3: "Deadline logic ... is not here yet; whoever records an entry sets its due date"; `dueOn` (line 54) | Drops stored `overdue` (D-10); adds `reference`; adds due-date arithmetic and an overdue query |
| `src/playbook.ts` | `CHANNELS = ["web-form"]` (line 7); `Playbook.form: WebForm` required; `reply.acknowledged_when` (line 27); `parsePlaybook` requires `form.url`, `form.selector`, `form.submit`, `form.fields` (lines 58-63) | Replaces `web-form` with `email` (D-2, D-3) |
| `brokers/broker-a.yaml` | `channel: web-form`, `form:` block, `reply.acknowledged_when` with `reference_pattern: "BA-[0-9]{6}"` | Rewritten for email (D-2) |
| `test/broker-a-form.test.ts`, `test/fixtures/broker-a-form.html` | Contract test of the playbook against a saved copy of the form; the only importer of `node-html-parser` (grep at `66295b1`) | Deleted (D-2) |
| `sites/broker-a/` | The fictitious broker's page served by `npm run site`; training material with a deliberate prompt injection | Kept unchanged: it serves another purpose (D-2). Its text ("Requests sent by email or post are not accepted") no longer describes broker A, and that is accepted |
| `.gitignore` | `ledger.json`, `.privacy-guard/` | Adds `subject.yaml` (D-5) |

The invariants this design must keep are in [review-checks.md](../../agents/review-checks.md):
nothing is sent without a confirmed send; deadlines are calendar months, not 30 days; no personal data
in fixtures, tests, issues or logs; playbooks are data; a broker's page is untrusted content.

## Proposal

### Scope

In: one request to broker A, by email. `draft` → confirmed `send` → due date → `report` flags it as
overdue. The receipt and the reply are recorded by hand.

Later (not in this PRD): re-requests per the playbook's `cadence`; the Article 12(3) two-month
extension a broker may claim; other brokers; reading the inbox automatically to find receipts and
replies. What happens after a request is overdue is D-1, open.

### The flow, worked through

A made-up subject, as in `subject.example.yaml` (D-5). Today is 2026-10-12.

```console
$ privacy-guard draft broker-a
From: Alex Example <alex.example@example.org>
To: privacy@broker-a.example
Subject: Erasure and objection request (GDPR Articles 17 and 21)

Dear Broker A,
...                                  (the rendered template, D-7)

drafted a request to broker-a. Review it, then: privacy-guard send --confirm

$ privacy-guard send                 # dry run: prints the same full message, sends nothing
dry run: nothing was sent. A real send needs --confirm.
From: Alex Example <alex.example@example.org>
...

$ privacy-guard send --confirm       # the human's marker exists (see Guarding the send)
sent to broker-a, due 2026-11-12

$ privacy-guard receipt broker-a BA-123456     # broker A's receipt arrives, 2026-10-13
recorded receipt BA-123456 for broker-a

$ privacy-guard report               # 2026-11-12: due today, not yet overdue
nothing is overdue                   # exit 0

$ privacy-guard report               # 2026-11-13: no reply recorded
broker-a: sent 2026-10-12, due 2026-11-12, 1 day overdue     # exit 1
```

Had the reply arrived on 2026-11-05, `privacy-guard reply broker-a 2026-11-05` would have marked the
request `acknowledged`, and both `report` runs would say "nothing is overdue".

The ledger after the send and the receipt. It holds the broker, the state, the dates and the receipt's
reference, nothing about the subject:

```json
{
  "entries": [
    {
      "broker": "broker-a",
      "state": "sent",
      "reference": "BA-123456",
      "dates": { "drafted": "2026-10-12", "sent": "2026-10-12", "due": "2026-11-12" }
    }
  ]
}
```

### Playbook (D-2, D-7)

`brokers/broker-a.yaml` becomes:

```yaml
# Broker A: requests by email. Fictitious broker for the training sandbox.
# Broker A moved from its web form to email in September 2026; the address is the one it wrote
# to the subject from that month (recorded 2026-10-12).
name: broker-a
display_name: Broker A
jurisdiction: EU
legal_basis:
  - gdpr-art-17   # right to erasure
  - gdpr-art-21   # right to object
channel: email
email:
  to: privacy@broker-a.example
  subject_line: "Erasure and objection request (GDPR Articles 17 and 21)"
reply:
  deadline: one-month     # GDPR Article 12(3)
cadence: every-90-days    # brokers re-add people; ask again (Later)
dry_run: true             # sending is a separate, confirmed step
```

In `src/playbook.ts`, `CHANNELS` becomes `["email"]`; `WebForm` and `Playbook.form` go; `Playbook`
gains `email: { to: string; subject_line: string; include?: string }`; `parsePlaybook` requires
`email.to` and `email.subject_line` (strings) for `channel: email` and no longer requires `form`.
`include` is the optional text a broker asks every request to quote (a form code, a reference
format); broker A asks for none. `reply.acknowledged_when` goes with the web form (D-3): its selector
pointed at the form's thank-you element, and what it captured was a receipt, not a reply. The field is
named `subject_line` because "subject" means the person (GLOSSARY).

### Subject file (D-5)

`subject.yaml` at the repo root, git-ignored, written by the human:

```yaml
full_name: Alex Example
email: alex.example@example.org
phone: "+00 000 000 000"   # optional
job_title: Test Engineer     # optional
```

A committed `subject.example.yaml` holds the made-up subject above; tests use it. Only `draft` and
`send` read `subject.yaml`, and only to render the message. Its values are never written to the
ledger, to an error message or to any log. A missing `subject.yaml`, or one without `full_name` or
`email`, makes `draft` and `send` refuse, naming the file and the missing key (never a value) and
pointing at `subject.example.yaml`.

### Request template (D-7)

One committed template, `templates/request.md`, for every broker. It cites Articles 17 and 21 and the
one-month deadline of Article 12(3). Placeholders: `{{ subject.full_name }}`, `{{ subject.email }}`,
`{{ subject.phone | optional }}`, `{{ subject.job_title | optional }}`, `{{ broker.display_name }}`,
`{{ broker.include | optional }}`. A line whose `| optional` placeholder has no value is dropped. A
placeholder without `| optional` that has no value, or a placeholder the renderer does not know, fails
the render, naming the placeholder. The `| optional` syntax is the one the web-form playbook already
used (`brokers/broker-a.yaml` lines 15-16).

A sketch; the exact wording is the template ticket's, reviewed by the user (this is not legal advice):

```text
Dear {{ broker.display_name }},

Under Article 17 of the GDPR I ask you to erase all personal data you hold about me. Under Article 21
I object to any processing of it for direct marketing, including selling or sharing it.

To find my data:
Name: {{ subject.full_name }}
Email: {{ subject.email }}
Phone: {{ subject.phone | optional }}
Job title: {{ subject.job_title | optional }}
{{ broker.include | optional }}

Article 12(3) of the GDPR requires you to act on this request without undue delay and in any event
within one month of receiving it. Please confirm to this address when you have done so.

{{ subject.full_name }}
```

With a subject that has no phone, the `Phone:` line is absent from the message. A second broker adds a
playbook with `to` and `subject_line` and no prose.

The message headers: `From` is the subject (`full_name <email>`), so the broker can match the request
to its profile; `To` is `email.to`; `Subject` is `email.subject_line`.

### Commands

| Command | Reads | Writes | Exit |
|---|---|---|---|
| `draft <broker>` | playbook, `subject.yaml`, template, ledger | new entry `{ broker, state: "drafted", dates: { drafted: today } }` | 0; 1 on refusal |
| `send [--confirm]` | ledger, playbooks, `subject.yaml`, template, SMTP env (confirmed only) | per delivered request: `state: "sent"`, `dates.sent`, `dates.due` | 0; 1 if any delivery fails |
| `receipt <broker> <reference>` | ledger | `reference` on the broker's open request | 0; 1 on refusal |
| `reply <broker> [YYYY-MM-DD]` | ledger | `state: "acknowledged"`, `dates.acknowledged` (default today) | 0; 1 on refusal |
| `report` | ledger | nothing | 1 if anything is overdue or unreadable as such, else 0 |
| `due` | ledger | nothing | unchanged: lists entries not `acknowledged` with `dates.due <= today` (`src/ledger.ts` line 56) |

An **open request** is one whose state is not `acknowledged` (`drafted`, `sent`, `escalated`).

- **`draft <broker>`** (D-8). Refuses when the broker has no playbook or already has an open request
  (naming the state and date). Renders the message first and writes the ledger entry only when the
  render succeeded, then prints the message for review. The rendered text is not stored: `send`
  renders it again from the template and `subject.yaml`, so an edit to either between draft and send
  shows in the dry run.
- **`send`** (D-4). For each `drafted` entry, as now (`src/cli.ts` line 44): render the message, then
  `guardedSend`. Without `--confirm`, print the full message (headers and body) under the existing
  "dry run: nothing was sent" line; no SMTP settings are needed. With `--confirm`, check the SMTP
  settings before contacting anything (a missing variable is named, its value never printed), deliver,
  and after each successful delivery set `state: "sent"`, `dates.sent = today`,
  `dates.due = dueDate(today)` and save the ledger at once, so a later failure in the same run cannot
  lose the record of a message that went out. A failed delivery leaves its entry `drafted`, prints
  "nothing was sent to <broker>" and exits 1. With one broker in scope, one run sends one message, so
  the hook's one-shot marker covers exactly one message.
- **`receipt <broker> <reference>`** (D-9). Stores the reference on the broker's open request in state
  `sent` or `escalated`. Refuses when there is none (a `drafted` request has not reached the broker).
  When the request already has a different reference, it replaces it and prints the old one. The
  state does not change: a receipt is not a reply (D-3).
- **`reply <broker> [YYYY-MM-DD]`** (D-9). Marks the broker's open request in state `sent` or
  `escalated` as `acknowledged`, with `dates.acknowledged` the given date or today. Refuses a date that
  is not `YYYY-MM-DD`, lies after today, or lies before `dates.sent`.
- **`report`** (D-11). Lists overdue requests only, one line each: broker, sent date, due date, days
  overdue. "nothing is overdue" and exit 0 when there are none; exit 1 when there is at least one, so a
  scheduled job notices. A `sent` entry without `dates.due` cannot be judged; `report` prints it as a
  warning line ("broker-x: sent 2026-09-01, no due date recorded") and counts it toward exit 1, because
  passing it silently would be a false green.

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

(Computed this session with a throwaway Node script, not with project code.)

A request is **overdue** on `today` when its stored state is `sent`, it has a due date, and
`today > dates.due`. On the due date itself it is not overdue. Days overdue is the number of calendar
days from the due date to today (2026-11-12 to 2026-11-13: 1). Overdue is computed on every read and
never stored, so `overdue` leaves `STATES`; `escalated` stays (D-1). An `escalated` request is not in
`report`, since the human has already acted on it; `acknowledged` ends the question.

No code writes `overdue` today (grep at `66295b1`: the only stored use is the test fixture at
`test/ledger.test.ts` line 52). A hand-edited ledger that still holds it fails `loadLedger` with the
existing message, which names the file, the entry and the allowed states (`src/ledger.ts` line 38).

### Guarding the send (D-4)

The send path stays behind both layers named in review-checks: `--confirm` on the command, checked by
`guardedSend`, and the human's one-shot marker `.privacy-guard/confirmed`, checked by
[deny-outward-send.sh](../../../.claude/hooks/deny-outward-send.sh). The marker is enforced by the hook
on an agent's tool call (its pattern `privacy-guard[[:space:]]+send`, line 37), not by the CLI; a
human running the command in their own terminal needs `--confirm` only. This PRD does not change the
hook; its self-test already covers `npx privacy-guard send --confirm broker-a` (lines 114, 118, 119).

SMTP settings come from the environment, never from a file in the repo:
`PRIVACY_GUARD_SMTP_HOST`, `PRIVACY_GUARD_SMTP_PORT`, `PRIVACY_GUARD_SMTP_USER`,
`PRIVACY_GUARD_SMTP_PASS`. The channel uses `nodemailer` (new dependency; not installed at `66295b1`,
`node_modules/nodemailer` absent). Tests never reach SMTP: they inject `deliver`, the seam `send.ts`
already has (line 8), as the tester agent's send tier requires. **Unverified:** a mail provider may
refuse a `From` address its account does not own, so the SMTP account should be the subject's own
mailbox; the send ticket documents this and a refusal surfaces as a failed delivery (entry stays
`drafted`, exit 1).

## Decisions

**Walk order:** D-1 is the only open decision. D-2 to D-12 were settled with the user in the grilling
session of 2026-10-12 and are recorded here once.

### D-1: What happens after a request becomes overdue?            OPEN

- **What it decides.** What privacy-guard does, if anything, once `report` lists a request as overdue:
  escalate to a supervisory authority itself, leave the next step to the human and record it, or first
  write to the broker again. On it hang: whether `escalated` gets a command that sets it, whether a
  second template and channel are needed, and what `report` and `due` show after escalation. Nothing
  else in this PRD waits on it: draft, send, receipt, reply and report ship under any answer.
- **The facts that constrain the options.**
  - GDPR Article 12(3): the broker must act within one month of receipt; that period "may be extended
    by two further months where necessary", provided the broker tells the subject within the first
    month. Handling an extension is out of scope here (Scope, Later), so privacy-guard cannot tell a
    request with a valid extension from one that is simply late; both look overdue.
  - GDPR Article 77(1): the subject may complain to a supervisory authority, "in particular in the
    Member State of his or her habitual residence, place of work or place of the alleged
    infringement". Which authority is right depends on the subject, so it is subject data, not
    playbook data, and no file holds it today.
  - A complaint is an outward send. review-checks: "Nothing is sent without a confirmed send". The
    hook's marker is one-shot (`deny-outward-send.sh` lines 16-18, 78).
  - A complaint carries personal data (who complains, about which request); the ledger may not hold it
    ([GLOSSARY.md](../../../GLOSSARY.md), Ledger) and nothing may log it.
  - `escalated` already exists as a stored state (`src/ledger.ts` line 8) but nothing sets it, and
    `dates` has no `escalated` field (line 17). `dueOn` excludes only `acknowledged` (line 56), so `due`
    keeps listing an `escalated` request whose due date has passed.
  - The only channel after this PRD is email to a broker. Authorities typically take complaints through
    their own web forms (not verified per authority).
- **Options.**
  - **(a) privacy-guard escalates to the supervisory authority.** It drafts an Article 77 complaint and
    sends it, still as a confirmed send, then sets `escalated`. Costs: a complaint template; a new
    subject field (the authority) and a new channel per authority, probably web forms, which this PRD
    just removed; a second confirmed send per request. Failure mode: a complaint filed while a valid
    extension runs (Article 12(3)) is premature, and nothing in privacy-guard can see the extension;
    being automatic it looks correct and is an irreversible outward write. Degrades: nothing when it
    works; when the authority's channel changes, every escalation fails. Still works: draft, send,
    report. Without the confirmed send it would break the first review check, so "automatic" can only
    mean "drafted automatically".
  - **(b) Queue it for the human.** `report` keeps flagging the request; the human decides (wait for a
    claimed extension, write to the broker, complain to the authority) and does it outside
    privacy-guard; `privacy-guard escalate <broker> [YYYY-MM-DD]` records `state: "escalated"` and
    `dates.escalated`. Costs: one small command and one date field. Failure mode: the human never acts,
    and the request stays in `report` with exit 1 every day; that is loud, not silent. A second: once
    marked `escalated` the request leaves `report`, and if the escalation stalls nothing flags it
    again. Degrades: no help writing the complaint. Still works: everything, and the extension
    question is left to the person who can read the broker's mail.
  - **(c) Reminder to the broker first, then escalate.** privacy-guard drafts a second letter to the
    broker (confirmed send, same email channel), records it, and escalates by (a) or (b) when that too
    goes unanswered. Costs: a second template, a new state or date for the reminder, and a grace period
    after the reminder that the GDPR does not define, so privacy-guard would invent a number. Failure
    mode: that invented grace period reads like a legal deadline and delays the complaint the law
    already allows. Degrades: as (a) or (b) at the end. Still works: everything before the reminder.
  - Rejected: storing nothing and doing nothing after `report` (the deadline would "mean something"
    for one day only, against the scope requirement above).
- **Proposal (for the walk, not decided).** (b). It keeps every outward write a confirmed send of a
  text the human chose, leaves the extension question with the only party who can see it, and costs
  one command. (a) or (c) can be added later as a draft helper on top of (b) without changing the
  states.
- **Worked example.** Sent 2026-10-12, due 2026-11-12, no reply; `report` on 2026-11-13 prints
  `broker-a: sent 2026-10-12, due 2026-11-12, 1 day overdue` and exits 1.
  - (a): privacy-guard drafts a complaint to the authority of the subject's residence and prints it;
    the human runs a confirmed send. If broker A had told the subject on 2026-11-02 that it extends to
    2027-01-12, the complaint is premature and already sent; nothing in the ledger showed it.
  - (b): the human reads broker A's mail, sees no extension, files a complaint on 2026-11-16, then runs
    `privacy-guard escalate broker-a 2026-11-16`. `report` on 2026-11-17 no longer lists broker A and
    exits 0 (if nothing else is overdue). `due` still lists it until D-1's ticket decides otherwise.
  - (c): privacy-guard drafts a reminder; the human sends it 2026-11-13; with a made-up 14-day grace
    period the escalation waits until 2026-11-27, two weeks the law did not ask for.
- **Impact.** (b): `src/ledger.ts` (`dates.escalated`), `src/cli.ts` (`escalate` command, usage),
  `test/cli.test.ts`, and whether `dueOn` should skip `escalated`. (a), (c): additionally a template,
  a subject field and, for (a), a new channel in `src/playbook.ts` and `src/send.ts`. Every option
  edits `src/cli.ts`, which every plan item below also edits: sequence D-1's ticket after item 6.
- **Interacts with.** D-10 (`escalated` stays a stored state, `overdue` does not), D-11 (`report`
  output and exit code), D-4 (confirmed send for any outward complaint or reminder), the Article 12(3)
  extension (Later), `cadence` re-requests (Later: whether an escalated broker gets a new request).

### D-2: Which channel does broker A take requests on?

**RESOLVED 2026-10-12 with the user: email, to `privacy@broker-a.example`; the web-form channel goes.**
A fact from the user: broker A moved from its web form to email in September 2026, and the subject has
had mail from that address. The playbook records the address's provenance and date in a comment.
`web-form` leaves `CHANNELS` and `parsePlaybook` stops requiring `form`, since no broker uses it.
`test/broker-a-form.test.ts` and `test/fixtures/broker-a-form.html` are deleted: they test a channel
broker A no longer has. `sites/broker-a/` stays: it is training material with another purpose.
Rejected: keeping `web-form` beside `email` for a future broker (dead code with no playbook to test it).

### D-3: Is the broker's confirmation of getting a request a reply?

**RESOLVED 2026-10-12 with the user: no; it is a receipt, and only a reply makes a request
`acknowledged`.** A receipt (with a reference such as `BA-123456`) proves delivery, not action; counting
it as a reply would stop the deadline the day after sending. The playbook key `acknowledged_when`, which
detected the form's thank-you element, goes with the web form; the email playbook has no such key.
Rejected: keeping `acknowledged` for a receipt (the deadline would mean nothing).

### D-4: How does `send --confirm` deliver?

**RESOLVED 2026-10-12 with the user: SMTP through `nodemailer`, `From` the subject, settings from
environment variables.** `From` is the subject's address so the broker can match the request to its
profile. SMTP host and credentials come from the environment, never a repo file. The dry run prints the
full message, headers and body, so the human approves exactly what goes out. The send stays behind
`--confirm` and the hook's marker. On success: `sent`, `dates.sent` today, `dates.due` computed (D-6).

### D-5: Where does the subject's data live?

**RESOLVED 2026-10-12 with the user: a git-ignored `subject.yaml`, with a committed
`subject.example.yaml` holding the made-up test subject.** `phone` and `job_title` are optional. The
file is read only at draft and send and never copied into the ledger or logs. Rejected: the ledger
(GLOSSARY: it holds no personal data) and the playbook (one broker's data, not the subject's).

### D-6: How is the due date computed?

**RESOLVED 2026-10-12 with the user: one calendar month after the sent date, clamped to the last day of
the target month.** 31 January gives 28 or 29 February; 31 August gives 30 September. The user chose
the conservative reading: never later than the law allows. Rejected: 30 days (review-checks: deadlines
are calendar months); rolling over into the next month (2026-01-31 to 2026-03-03, later than the law
allows).

### D-7: Where does the request text live?

**RESOLVED 2026-10-12 with the user: one shared committed template, `templates/request.md`; a playbook
adds only `to`, the subject line and any text the broker asks to quote.** A second broker then needs no
new prose. Rejected: request text per playbook (copies of the legal text drift apart).

### D-8: What does `draft` store?

**RESOLVED 2026-10-12 with the user: a ledger entry `drafted` with broker and date only; the rendered
text is printed, not stored, and `send` renders it again.** `draft` refuses when the broker already has
an open request. Storing the text would put personal data in the ledger.

### D-9: How are a receipt and a reply recorded?

**RESOLVED 2026-10-12 with the user: by hand, with `receipt <broker> <reference>` and
`reply <broker> [YYYY-MM-DD]`.** The reference is the broker's, not personal data, so the ledger may
hold it. Reading the inbox is Later.

### D-10: Is overdue a stored state?

**RESOLVED 2026-10-12 with the user: no; it is derived at read time.** Overdue: sent, no reply, today
strictly after the due date; on the due date itself not yet overdue. `overdue` leaves `STATES`;
`escalated` stays, for D-1. A stored `overdue` would go stale the moment a reply is recorded or a date
corrected, and nothing writes it today.

### D-11: What does `report` show and return?

**RESOLVED 2026-10-12 with the user: only overdue requests (broker, sent date, due date, days overdue);
exit 1 when anything is overdue, 0 otherwise, so a scheduled job notices.** `due` stays as it is
(entries due on or before today).

### D-12: Is there an existing request to backfill?

**RESOLVED 2026-10-12 with the user: no.** The subject's earlier exchange with broker A answered a
general question; it was not a request. Nothing to record.

## Implementation plan

Each item is one ticket, sized for one session. All of them edit `src/cli.ts` or `src/ledger.ts`, so
they land one at a time in the order given; the blocking edges below are the ones the design forces.
An item that changes an existing assertion names it, which is the tester agent's authority once this
PRD is in `reviewed/`.

- [ ] **1. Broker A by email; drop the web form.** Follows D-2, D-3. Rewrite `brokers/broker-a.yaml`
  as in Playbook above; `CHANNELS = ["email"]`, `Playbook.email`, `parsePlaybook` requires `email.to`
  and `email.subject_line`, no `form`, no `acknowledged_when`. Delete `test/broker-a-form.test.ts` and
  `test/fixtures/broker-a-form.html`; remove the `node-html-parser` dev dependency (its only importer).
  Keep `sites/broker-a/` and the `site` script. Assertions changed in `test/playbook.test.ts`: line 18
  (`web-form` becomes `email`), line 19 (`form.selector` becomes `email.to`), line 24 (the fixture
  playbook without `channel` loses its `form:` block). Blocked by: none.
- [ ] **2. Overdue derived; `report` command.** Follows D-10, D-11. Remove `overdue` from `STATES`;
  add an overdue query (state `sent`, due date set, `today > due`) and days overdue; add `report` with
  the output and exit codes in Commands, including the warning for a `sent` entry without a due date.
  Assertion changed: `test/ledger.test.ts` line 52 (the `past-due` fixture's state `overdue` becomes
  `sent`; the `dueOn` expectation on line 60 stays). Works on a hand-written ledger. Blocked by: none.
- [ ] **3. Due date arithmetic.** Follows D-6. `dueDate(sent)` in `src/ledger.ts` with the table in
  Due date and overdue as tests, including both leap and non-leap February; update the comment on
  `src/ledger.ts` line 3. Blocked by: none.
- [ ] **4. Subject file, request template, `draft`.** Follows D-5, D-7, D-8. `subject.example.yaml`
  with the made-up subject; `subject.yaml` in `.gitignore`; `templates/request.md` (wording reviewed by
  the user in the ticket's PR); the renderer with `| optional` line dropping and named failures;
  `draft <broker>` as in Commands. Point the review-checks line "Use the made-up subject in
  `test/fixtures/`" at `subject.example.yaml` (no such subject exists in `test/fixtures/` at
  `66295b1`). Assertion changed: `test/cli.test.ts` lines 66-70 ("draft says it is not implemented
  yet"). Blocked by: 1.
- [ ] **5. `send --confirm` over SMTP.** Follows D-4, D-6. Add `nodemailer`; an SMTP `deliver` reading
  the `PRIVACY_GUARD_SMTP_*` variables; `SendRequest` carries the rendered message; dry run prints the
  full message; on success write `sent`, `dates.sent`, `dates.due` and save per entry. Tests inject
  `deliver`; none contacts SMTP. Check the installed `nodemailer` API against its source, not memory.
  Assertions changed in `test/cli.test.ts`: lines 52-57 ("would send to broker-a" becomes the printed
  message) and lines 59-63 (a confirmed send with a fake `deliver` now succeeds; the "not implemented
  yet" case is replaced by a failing `deliver` that leaves the entry `drafted`). Blocked by: 3, 4.
- [ ] **6. `receipt` and `reply`.** Follows D-3, D-9. `reference?: string` on `LedgerEntry`, validated
  as a string by `loadLedger`; the two commands with the refusals in Commands; usage line updated. A
  test that `reply` takes the request out of `report`. Blocked by: 2.
- [ ] **7. After overdue.** Follows D-1, **open**: no ticket until D-1 is resolved. Under the proposal
  (b): an `escalate <broker> [YYYY-MM-DD]` command and `dates.escalated`. Blocked by: 2, 6.
- [ ] **8. User docs.** README: setting up `subject.yaml` and the SMTP variables, the commands, the
  confirmed send, running `report` on a schedule. For the `documenter` agent once 1 to 6 are merged.
  Blocked by: 1 to 6.

Test tier: everything above is covered by the one vitest tier in `test/` (`npm test`). No live or
fixture tier remains for broker A once item 1 deletes the form fixture; the send tier is the injected
`deliver` in item 5.
