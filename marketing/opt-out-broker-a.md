# Opt out of broker A: from draft to deadline

Source: [docs/prds/completed/opt-out-broker-a.md](../docs/prds/completed/opt-out-broker-a.md)
(issue #2). Claims below were checked against the code on `main` at `23e19ea` (`src/`, `bin/`,
`brokers/broker-a.yaml`). privacy-guard is not legal advice, and nothing here is.

Positioning follows the [README](../README.md): privacy-guard asks data brokers to erase a person's
data and stop selling it (GDPR Articles 17 and 21) and holds each broker to the one-month deadline
for its reply.

## Pitch

Asking a data broker to erase your data is the easy part. Knowing a month later whether it answered
is the hard part. privacy-guard now covers the whole path for one broker, broker A: it fills in
broker A's opt-out form from a local file the user keeps, shows exactly what it will submit, submits
only when the user confirms, and records broker A's receipt reference and the due date. From the day
after the due date, `report` says the request is overdue, and it keeps saying so (exit code 1, every
run) until the user records a reply. A send that may or may not have arrived is never lost or quietly
counted as a success. It stays on the report until the user decides what happened. The ledger holds
dates, states and broker A's reference, never the person's details.

## Who it is for

- **A person who wants a broker to stop selling their data** and wants the one-month deadline to
  mean something, without keeping a calendar of their own.
- **Someone who runs privacy-guard on a schedule or through an AI agent** and needs a missed deadline
  or a failed send to show up as a non-zero exit, not as a line nobody reads.
- **Whoever adds the next broker.** Broker A's form, fields and receipt pattern live in a playbook
  (`brokers/broker-a.yaml`), not in code, so the path is built to be reused for other web-form brokers.

## Before and after

| Today you... | With this you... |
|---|---|
| fill in a broker's opt-out form by hand and hope you saved the reference | run `draft broker-a`, check the preview, run `send broker-a --confirm`; the receipt reference is read from broker A's thank-you page and stored |
| work out "one month from now" yourself, and get the month ends wrong | get the due date computed for you: one calendar month later, the last day of the month when the target month is shorter, and a Saturday or Sunday due date moved to the following Monday |
| notice a missed deadline only if you happen to remember it | run `report` (by hand or on a schedule); it names each overdue request with its sent date, due date and days overdue, and exits 1 |
| lose track of a submission when the page timed out or showed no reference | find it on `report` as "submitted, no receipt" every day until you record that it arrived (`receipt`), drop it (`discard`), or a later send gets a receipt |
| keep notes on whether you went to the supervisory authority | record it with `escalate broker-a [date]`; `report` keeps listing the request until broker A's reply is recorded |
| risk your name and email ending up in logs or an agent's transcript | see the subject's values masked in every preview unless you ask for them with `--show`; error messages never print them; the ledger never stores them |

## Business cases

1. **A deadline that enforces itself.** The request's clock starts on the day of the first submission,
   once a receipt shows broker A got it, and `report`
   flags it from the first day after the due date, without being asked twice. Benefit: risk
   removed. A broker's missed deadline is noticed on the first day it is missed, not whenever
   someone remembers to look.

2. **Safe to run unattended.** `report` exits 1 whenever something needs the human: an overdue
   request, a submission with no receipt, an escalated request with no reply, or a sent request with
   no due date. Nothing snoozes it. Benefit: integration unlocked. A cron job, CI step or scheduled
   agent can watch the ledger and alert on a plain exit code.

3. **No false deadlines, no lost attempts.** When a confirmed send comes back without a reference
   (a timeout, an error status, a redirect, an oversized answer, the form shown again), the request
   is not marked sent and not forgotten. It is recorded as submitted, and `report` shows it until the
   user resolves it. Only a connection that clearly never opened counts as "nothing was sent". A
   repeat send warns first. Benefit: risk removed. The tool never starts a deadline broker A may
   never have had, and never lets a request disappear without anyone noticing.

4. **Exactly what you approved, nothing more.** Every send is a dry run until `--confirm`. One
   confirmed send reaches one broker with one submission, and the dry run prints the address and
   every field first. When an AI agent runs privacy-guard, a repository hook also requires a
   one-time approval marker from the human. Benefit: risk removed. An agent can prepare the work,
   and only the human releases it.

5. **Personal data stays out of the trail.** The subject's details live in a git-ignored
   `subject.yaml`, are read only by `draft` and `send`, and are masked in output by default. The
   ledger holds broker, state, dates and broker A's reference. Broker A's response is parsed without
   running script, and only the matched reference is kept. Benefit: risk removed. Logs, transcripts
   and the ledger can be shared or reviewed without exposing the person.

6. **A path to reuse.** The form's address, fields and receipt pattern are playbook data, the field
   renderer is generic, and a contract test checks the playbook against a saved copy of the form.
   Benefit: tool reuse. The next web-form broker is mostly a new playbook and its test, not new send
   logic.

## User stories

1. As a subject, I want to draft a request to broker A from my own details file, so that I do not
   retype my details into each broker's form.
2. As a subject, I want to see exactly which address and fields will be submitted before anything
   goes out, so that I approve what is actually sent.
3. As a subject, I want nothing to reach broker A until I confirm the send, so that a mistake or an
   agent cannot send on my behalf.
4. As a subject, I want broker A's receipt reference recorded with the send, so that I can prove my
   request was taken.
5. As a subject, I want the due date computed as one calendar month after sending, moved off a
   weekend, so that I do not flag broker A as late before the deadline has passed.
6. As a subject, I want `report` to tell me which requests are overdue and by how many days, so that
   I know when to act.
7. As someone running privacy-guard on a schedule, I want `report` to exit non-zero while anything
   is overdue or unresolved, so that my job alerts me without my reading its output.
8. As a subject, I want a send that came back without a receipt to stay visible until I resolve it,
   so that I neither lose the request nor send a duplicate by accident.
9. As a subject, I want to record a receipt from broker A's mail, or discard an attempt that never
   arrived, so that the report reflects what I actually know.
10. As a subject, I want to record broker A's reply by hand with its date, so that the request leaves
    the report once broker A has answered.
11. As a subject, I want to record that I took an overdue request to the supervisory authority, so
    that my ledger shows the escalation and keeps the request visible until broker A replies.
12. As a subject working with an AI agent, I want my details masked in every preview and error, so
    that they never end up in the agent's transcript.

## Honest limits

- **One broker, and it is fictitious.** Broker A is a training broker served locally by
  `npm run site` at `http://localhost:8080/`. No real broker has a playbook yet, so this does not
  opt anyone out of a real broker today.
- **Web forms only.** No email or postal requests, and no letter template.
- **Replies are recorded by hand.** privacy-guard does not read an inbox. It cannot tell whether
  broker A replied unless the user runs `reply`.
- **No complaints are filed.** `escalate` records that the human went to the supervisory authority.
  privacy-guard drafts and sends nothing to an authority.
- **No extensions.** A broker may extend the deadline by two further months (GDPR Article 12(3)).
  privacy-guard does not track that, so a validly extended request still shows as overdue. The user
  has to judge that case.
- **Weekends only, not public holidays.** A Saturday or Sunday due date moves to Monday. Public
  holidays are not considered.
- **No repeat requests yet.** The playbook names a 90-day cadence, but nothing re-sends on it.
- **One known defect.** Issue #34: a reused reference from broker A is taken as a receipt and starts
  the deadline. Until it is fixed, a receipt is only as reliable as broker A's thank-you page.
- **Not legal advice.** Dates and states are a tracking aid. They are not a legal judgment that a
  broker is in breach.
