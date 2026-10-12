# privacy-guard

privacy-guard asks data brokers to erase your personal data and stop selling it (GDPR Articles 17
and 21). It also holds each broker to the one-month deadline for its reply. You draft a request,
check it, and send it yourself. privacy-guard records the broker's receipt, works out the due date,
and keeps reporting the request until you record the broker's reply.

Sending is a dry run unless you add `--confirm`. privacy-guard is not legal advice.

This guide follows one request, to **broker A**, from start to finish. Broker A is a fictitious
broker. Its opt-out page runs on your own machine (`npm run site`), so you can work through the
whole flow without contacting anyone. The terms used here (request, receipt, reply, due date,
overdue, and so on) are defined in [GLOSSARY.md](GLOSSARY.md).

## Contents

- [Before you start](#before-you-start)
- [Set up the subject file](#set-up-the-subject-file)
- [Run broker A's site](#run-broker-as-site)
- [Opt out of broker A, start to finish](#opt-out-of-broker-a-start-to-finish)
- [Commands](#commands)
- [When a send gets no receipt](#when-a-send-gets-no-receipt)
- [Run `report` on a schedule](#run-report-on-a-schedule)
- [What is stored where](#what-is-stored-where)
- [Known limitations](#known-limitations)

## Before you start

- Node.js 22.18 or later. privacy-guard runs its TypeScript directly, so there is no build step.
- Install the dependencies once: `npm install`.
- **Run every command from the repository root.** privacy-guard looks for `subject.yaml`,
  `ledger.json` and the `brokers/` folder in the current directory.

The examples below are written as `privacy-guard <command>`. To run the commands as written, run
`npm link` once. Otherwise, run `node bin/privacy-guard.js <command>`.

## Set up the subject file

The **subject** is the person the requests are about: usually you. Their details go in
`subject.yaml` at the repository root. Git ignores this file, so it stays on your machine. Create it
from the example:

```console
$ cp subject.example.yaml subject.yaml
```

Then replace the made-up values with your own:

```yaml
full_name: "Alex Example"
email: "alex.example@example.org"
phone: "+00 000 000 000"     # optional
job_title: "Test Engineer"   # optional
```

| Key | Required | Used for |
|---|---|---|
| `full_name` | yes | broker A's `name` field |
| `email` | yes | broker A's `email` field |
| `phone` | no | broker A's `phone` field; sent empty when absent |
| `job_title` | no | broker A's `job_title` field; sent empty when absent |

**Put every value in quotes.** YAML reads an unquoted `phone: 0612345678` as the number 612345678 and
drops the leading zero, so the broker would get the wrong number. privacy-guard refuses a value that
YAML reads as a number, as `true` or `false`, or as empty. It can't tell whether you quoted a value
that YAML reads as text anyway, so quote every value rather than rely on the check. To leave out an
optional key, delete its line; don't leave the key there with an empty value.

`draft` and `send` read `subject.yaml` only to fill in the broker's form. They never copy its
values into the ledger, and error messages give the key, never its value. If the file is wrong,
`draft` and `send` refuse and exit 1 with one of these messages:

| Message | Meaning |
|---|---|
| `subject.yaml: not found; create it from the example and fill it in (see subject.example.yaml)` | There is no `subject.yaml` in the current directory. |
| `subject.yaml: "phone" must be a quoted string; quote its value (see subject.example.yaml)` | A value is a number, `true` or `false`, or empty. Put it in quotes. |
| `subject.yaml: missing required key "email" (see subject.example.yaml)` | `full_name` or `email` is missing or empty. |
| `subject.yaml: unknown key "address" (expected one of: full_name, email, phone, job_title) (see subject.example.yaml)` | Only the four keys above are allowed. |
| `subject.yaml: not valid YAML at line 3 (see subject.example.yaml)` | The file can't be parsed. The message gives the line but not its text. |
| `subject.yaml: expected a YAML mapping (see subject.example.yaml)` | The file is empty or isn't a list of `key: "value"` lines. |

## Run broker A's site

Broker A's opt-out page has to be running for a confirmed send to reach it. In a second terminal,
run:

```console
$ npm run site
Broker A (fictitious) on http://localhost:8080/
```

The site keeps running until you stop it with Ctrl-C. You can open http://localhost:8080/ in a
browser to see the form that privacy-guard fills in. The site works like this:

- If the submission is valid, it answers with a thank-you page that shows a receipt reference such
  as `BA-482915`. The six digits are random each time.
- If a submission is missing the name, the email, the request type or the identity confirmation, the
  site answers 400 and gives no reference.
- It stores nothing and doesn't log what you send.

If the site isn't running, a confirmed send stops before anything goes out: `nothing was sent to
broker-a: the connection failed (ECONNREFUSED)`.

How privacy-guard fills in broker A's form (the address, the fields, and where the receipt
reference is found) is set out in broker A's playbook, [brokers/broker-a.yaml](brokers/broker-a.yaml).

## Opt out of broker A, start to finish

In this example, today is 2026-10-12, `subject.yaml` holds the made-up subject from the example
file, and `npm run site` is running.

**1. Draft the request.** This creates the request in the ledger and prints what would be sent.
Values from `subject.yaml` are hidden.

```console
$ privacy-guard draft broker-a
POST http://localhost:8080/  (form#opt-out-form)
  name              [subject.full_name]
  email             [subject.email]
  phone             [subject.phone]
  job_title         [subject.job_title]
  request_type      both
  confirm_identity  on
Subject values are hidden. To see them: privacy-guard send broker-a --show

drafted a request to broker-a. Review it, then: privacy-guard send broker-a --confirm
```

`request_type both` asks broker A both to erase your data (Article 17) and to stop processing it
(Article 21).

**2. Check what will be sent.** Without `--confirm`, `send` is a dry run that contacts nobody.
Add `--show` to see the real values:

```console
$ privacy-guard send broker-a --show
dry run: nothing was sent. A real send needs --confirm.
POST http://localhost:8080/  (form#opt-out-form)
  name              Alex Example
  email             alex.example@example.org
  phone             +00 000 000 000
  job_title         Test Engineer
  request_type      both
  confirm_identity  on
```

**3. Send it.** This is the confirmed send: privacy-guard submits the form once and reads the
receipt reference from broker A's thank-you page.

```console
$ privacy-guard send broker-a --confirm
sent to broker-a, receipt BA-482915, due 2026-11-12
```

The request is now **sent**, and broker A's month has started.

**4. Wait for the reply.** `report` lists only what needs your attention:

```console
$ privacy-guard report               # on 2026-11-12, the due date: not overdue yet
nothing is overdue

$ privacy-guard report               # on 2026-11-13, with no reply recorded
broker-a: sent 2026-10-12, due 2026-11-12, 1 day overdue
```

**5a. If broker A replies**, record the date of the reply. Then the request no longer appears in
`report`:

```console
$ privacy-guard reply broker-a 2026-11-05
recorded broker-a as acknowledged 2026-11-05
```

**5b. If broker A misses the deadline**, you decide what to do next. For example, you might file a
complaint with your supervisory authority. privacy-guard files nothing. Once you have filed, record
it:

```console
$ privacy-guard escalate broker-a 2026-11-16
recorded broker-a as escalated 2026-11-16; it stays in report until a reply is recorded

$ privacy-guard report
broker-a: escalated 2026-11-16, no reply
```

The escalated request stays in `report` every day until you record broker A's reply with `reply`.

## Commands

| Command | What it does | Exit code |
|---|---|---|
| `draft <broker> [--show]` | Starts a request and prints the submission | 0; 1 on refusal |
| `send <broker> [--show]` | Dry run: prints the submission, contacts nobody | 0; 1 on refusal |
| `send <broker> --confirm` | Confirmed send: submits the broker's form once | 0 with a receipt; 1 otherwise |
| `reply <broker> [YYYY-MM-DD]` | Records the broker's reply | 0; 1 on refusal |
| `escalate <broker> [YYYY-MM-DD]` | Records that you took an overdue request to the authority | 0; 1 on refusal |
| `receipt <broker> [reference]` | Records that a submission without a receipt did arrive | 0; 1 on refusal |
| `discard <broker>` | Removes a submission without a receipt that did not arrive | 0; 1 on refusal |
| `report` | Lists what needs you | 0 if nothing; 1 if anything |
| `due` | Lists open requests whose due date is today or earlier | 0 |

An unknown command name prints the usage line and exits 2. So do `reply`, `escalate`, `receipt` and
`discard` when the broker is missing, when there is an extra argument, or when they are given a
`--flag`. The other commands are less strict:

- `draft` ignores extra arguments and unknown flags. For example, `draft broker-a --sho` drafts
  with the values hidden.
- `send` refuses a second broker or an unknown flag with exit 1. See the confirmed send below.
- `report` and `due` ignore any arguments.

A broker has at most one **open request**: one that is drafted, sent or escalated, with no reply
recorded yet.

### `draft <broker> [--show]`

Starts a request to the broker and prints the submission that `send` would make. Values from
`subject.yaml` are shown as their placeholder (`[subject.email]`), or as `(empty)` when an optional
value is absent. `--show` prints the real values instead.

The ledger records only the broker, the state `drafted` and today's date. The filled-in fields are
not stored. `send` fills them in again from `subject.yaml`, so if you edit `subject.yaml` after
drafting, the change shows up in the next dry run.

Refusals (exit 1):

- `no playbook for broker-x in brokers`: there is no `brokers/broker-x.yaml`.
- `broker-a already has an open request: sent 2026-10-12`: finish or resolve that request first.
  After `reply`, you can draft a new request to the broker.
- Any of the subject-file messages in [Set up the subject file](#set-up-the-subject-file). In that
  case, nothing is written to the ledger.

### `send <broker>`: the dry run and `--show`

Without `--confirm`, `send` only prints `dry run: nothing was sent. A real send needs --confirm.`
followed by the submission, and exits 0. It contacts nobody and changes nothing. Values are hidden
unless you add `--show`.

`--show` prints the subject's values in your terminal. Leave it off whenever the output could end
up somewhere else, such as a log or a shared screen. Error messages never print a subject value,
with or without `--show`.

### `send <broker> --confirm`: the confirmed send

A **confirmed send** is one you approved by adding `--confirm`. It is the only way privacy-guard
sends anything. It sends one request to one broker: the broker's single drafted request. You can put
flags before or after the broker name.

What happens:

1. privacy-guard fills in the form from `subject.yaml` and sends it to the address in the playbook,
   as one HTTP POST. It does not follow redirects. It waits at most 10 seconds and reads at most
   1 MB of the answer.
2. It looks for the receipt reference on the broker's answer page. For broker A, that means
   `BA-` followed by six digits, in the thank-you text. Nothing else from the page is printed or
   stored.
3. If it finds a reference, the request becomes **sent**. The ledger records the reference, the sent
   date and the due date, and privacy-guard prints
   `sent to broker-a, receipt BA-482915, due 2026-11-12`. Exit 0.

The **due date** is one calendar month after the sent date. If that month has no such day, it is
the last day of the month (2028-01-31 gives 2028-02-29). If the due date falls on a Saturday or a
Sunday, it moves to the following Monday (2026-01-31 gives 2026-03-02). A request is **overdue** from
the day after its due date. On the due date itself, it is not overdue yet.

Refusals (exit 1, nothing is sent):

- `no drafted request for broker-a. Draft one first: privacy-guard draft broker-a`
- `send takes one broker and only --confirm and --show; refusing: --confrim. Nothing was sent.`: a
  mistyped flag or a second broker is refused. It is never treated as a dry run.
- `broker-a has 2 drafted requests in ledger.json; expected one. Nothing was sent.`: this happens
  only after someone edits the ledger by hand.
- `nothing was sent to broker-a: the connection failed (ECONNREFUSED)` (or `ENOTFOUND`): the
  connection was never made, so broker A received nothing. The request stays drafted, and you can
  send again once the site is reachable.

Any other result without a receipt exits 1 and may have reached the broker. See
[When a send gets no receipt](#when-a-send-gets-no-receipt).

If you run privacy-guard through an AI agent (Claude Code, with this repository's hooks), the agent's
send is also blocked until you approve it. Create the marker file from your own terminal, in the
repository root: `mkdir -p .privacy-guard && touch .privacy-guard/confirmed`. The marker allows one
send. The hook removes it when it lets the send through. When you run the command in your own
terminal, `--confirm` is all you need.

### `reply <broker> [YYYY-MM-DD]`

Records that the broker replied, on the date you give (default: today). Use it whatever the reply
said: erased, refused, or asking for more. The request becomes **acknowledged** and leaves `report`.

```console
$ privacy-guard reply broker-a 2026-11-05
recorded broker-a as acknowledged 2026-11-05
```

Refusals (exit 1):

- `broker-a has no sent or escalated request: found drafted 2026-10-12` (or `found no request`)
- `date "5 Nov" is not a YYYY-MM-DD date`
- `date 2026-12-01 lies after today, 2026-11-13`
- `date 2026-10-01 lies before the sent date, 2026-10-12`

### `escalate <broker> [YYYY-MM-DD]`

Records that you took an overdue request to a supervisory authority, on the date you give (default:
today). privacy-guard files nothing and sends nothing. The request becomes **escalated**. From then
on, `report` lists it and exits 1 every day until you record a reply with `reply`.

Only a sent request that is overdue can be escalated. The other cases are refused (exit 1), with a
message such as:

- `broker-a: not overdue until after its due date, 2026-11-12 (today is 2026-11-12)`
- `broker-a: only an overdue sent request can be escalated; found drafted 2026-10-12`
- `broker-a: already escalated 2026-11-16`
- `broker-a: no request to escalate`

The date follows the same rules as for `reply`.

### `receipt <broker> [reference]` and `discard <broker>`

These two commands resolve a confirmed send that got no receipt. They are explained in
[When a send gets no receipt](#when-a-send-gets-no-receipt).

### `report`

Lists everything that needs your attention, one line each, and exits 1 if there is at least one
line. If there is nothing, it prints `nothing is overdue` and exits 0.

| Line | Meaning | Resolved by |
|---|---|---|
| `broker-a: sent 2026-10-12, due 2026-11-12, 1 day overdue` | The due date has passed with no reply | `reply`, or `escalate` and later `reply` |
| `broker-a: submitted 2026-10-12, no receipt` | A confirmed send may have arrived, but there is no receipt | `receipt`, `discard`, or a send that gets a receipt |
| `broker-a: escalated 2026-11-16, no reply` | You escalated; the broker still hasn't replied | `reply` |
| `broker-x: sent 2026-09-01, no due date recorded` | A hand-edited ledger entry can't be checked | fix the entry in `ledger.json` |

`report` never changes the ledger, and you can't snooze a line.

### `due`

Lists every request that is not acknowledged and whose due date is today or earlier, including
escalated ones, as `broker-a: sent, due 2026-11-12`. If there are none, it prints `nothing is due`.
`due` exits 0 whatever it lists, so use `report` for scheduled checks. (Like every command, it
exits non-zero if `ledger.json` can't be read.)

## When a send gets no receipt

Sometimes a confirmed send doesn't come back with a receipt reference. The request may or may not
have reached broker A. privacy-guard can't tell which, so it doesn't start the deadline and doesn't
forget the attempt either:

```console
$ privacy-guard send broker-a --confirm
broker-a answered 200 without a receipt reference; the request may or may not have arrived.
Check Broker A's mail before sending again.
```

The first line says what happened. It never quotes the broker's page:

- `timed out after 10 seconds`
- `answered 400` (or another error status)
- `answered 302, a redirect, which was not followed`
- `answered 200 with the form again`
- `answered 200 without a receipt reference`
- `answered with more than 1 MB, which was not read`
- `could not be reached to the end (UND_ERR_SOCKET)` (or another error code)

The request stays **drafted**, and the ledger records the date of the attempt as its submitted
date. The exit code is 1. Until you resolve it, `report` lists the request every day and exits 1:

```console
$ privacy-guard report
broker-a: submitted 2026-10-12, no receipt
```

Check broker A's mail, then choose one of these:

- **It arrived, and the mail gives a reference.** Record it:

  ```console
  $ privacy-guard receipt broker-a BA-482915
  recorded receipt BA-482915 for broker-a: sent 2026-10-12, due 2026-11-12
  ```

- **It arrived, but there is no reference.** Leave the reference out:

  ```console
  $ privacy-guard receipt broker-a
  recorded broker-a as sent 2026-10-12, due 2026-11-12, no reference
  ```

- **It did not arrive, or you want to withdraw it.** Discard the attempt. You can then draft a new
  request and send it:

  ```console
  $ privacy-guard discard broker-a
  discarded broker-a: drafted 2026-10-12, submitted 2026-10-12
  ```

- **You can't tell, and you decide to send again.** Run `send broker-a --confirm` again. The dry run
  and the send first warn
  `a submission on 2026-10-12 got no receipt; check Broker A's mail before sending again`. If both
  attempts arrived, broker A gets two requests.

`receipt` and a later send that gets a receipt both date the request from the **first** attempt.
For example, if you send again on 2026-10-14 and get a receipt, the request still counts as sent
2026-10-12 and due 2026-11-12. If the first attempt did arrive, broker A's month started that day.
This way, privacy-guard never shows a due date later than the law allows. If that date is already
past, the next `report` shows the request as overdue.

Refusals (exit 1):

- `reference "BA-48291" does not match broker-a's reference pattern BA-[0-9]{6}`: the whole
  reference must match the pattern.
- `broker-a has no submission without a receipt: found sent 2026-10-12`. Other things it can find
  instead are `drafted 2026-10-12, not submitted` and `no request`. `discard` refuses the same way,
  so it can't remove a sent request or a draft that was never submitted.

## Run `report` on a schedule

`report` is designed to run unattended. Exit 0 means nothing needs you. Any other exit code means
you should look:

| Exit | Meaning |
|---|---|
| 0 | Nothing is overdue, unresolved or escalated (`nothing is overdue`) |
| 1 | At least one line needs you: an overdue request, a submission without a receipt, an escalated request without a reply, or a sent request without a due date. An error such as an unreadable `ledger.json` also exits non-zero. |
| 2 | Usage error (the command line is wrong) |

For example, this cron entry checks every morning at 08:00 and prints `report`'s lines only when
something needs you. cron mails any output to you, provided mail is set up on your machine. Replace
the path with your own:

```cron
0 8 * * * cd /home/alex/privacy-guard && out=$(node bin/privacy-guard.js report 2>&1) || echo "$out"
```

Some points to check:

- Change to the repository directory first (`cd`), because `report` reads `ledger.json` from the
  current directory. Run it from somewhere else and it finds no ledger, so it reports nothing.
- cron's `PATH` must find Node 22.18 or later. If it doesn't, write the full path to `node`.
- `report` only reads the ledger. It never sends anything, so it is safe to run on a schedule.
- A red `report` stays red until you act. An overdue request stays listed until you record a reply.
  An escalated request stays listed until the broker replies.

## What is stored where

| File | Holds | In git |
|---|---|---|
| `subject.yaml` | The subject's details (personal data) | no, ignored |
| `ledger.json` | One entry per request: broker, state, dates, receipt reference. No personal data. Created by the first `draft`. | no, ignored |
| `brokers/<broker>.yaml` | The broker's playbook: its form, fields and receipt pattern | yes |
| `.privacy-guard/confirmed` | Your one-time approval for an agent's send (see the confirmed send) | no, ignored |

A ledger entry after the send in the example:

```json
{
  "entries": [
    {
      "broker": "broker-a",
      "state": "sent",
      "dates": { "drafted": "2026-10-12", "sent": "2026-10-12", "due": "2026-11-12" },
      "reference": "BA-482915"
    }
  ]
}
```

The `dates` object can also hold `submitted` (a confirmed send without a receipt), `acknowledged`
(the reply) and `escalated`.

## Known limitations

- **Broker A only.** Broker A is the only broker with a playbook, and a web form is the only
  channel.
- **No two-month extension.** A broker may extend its deadline by two months if it tells you
  within the first month (Article 12(3)). privacy-guard doesn't track extensions, so such a request
  shows as overdue after one month. Check the broker's mail before you escalate.
- **No repeat requests.** The playbook's `cadence` (ask again every 90 days) is not acted on yet.
- **Replies are recorded by hand.** privacy-guard doesn't read your mail.
- **Public holidays don't move the due date.** Only weekends do.
- **A reused reference counts as a receipt.** Suppose broker A answers a new request with the
  reference it gave an earlier one. privacy-guard still records the request as sent and starts a
  deadline that broker A may not be honouring. Compare the reference with your earlier requests
  (`ledger.json`) after each send. Issue #34 tracks this.

The design decisions behind this behaviour are in the PRD,
[docs/prds/implemented/opt-out-broker-a.md](docs/prds/implemented/opt-out-broker-a.md).

## License

[MIT](LICENSE)
