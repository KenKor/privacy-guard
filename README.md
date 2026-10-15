# privacy-guard

Asks data brokers to stop selling a person's data (GDPR Articles 17 and 21) and tracks each request
against the one-month deadline for the broker's reply. Not legal advice.

Needs Node 22.18 or later. Install with `npm install`.

## The subject file

The subject is the person the requests are about. Their details go in `subject.yaml`, which git
ignores. Start from the made-up example:

```sh
cp subject.example.yaml subject.yaml
```

`full_name` and `email` are required; `phone` and `job_title` are optional. Quote every value, so a
phone number keeps its leading zero.

## Usage

Each broker has a playbook in `brokers/`. A request goes through three states: `drafted`, `sent`
and `acknowledged`. The ledger, `ledger.json`, records where each one stands. It holds no personal
data.

```sh
npx privacy-guard draft broker-a
```

Prints the submission it would make, with the subject's details masked as `[subject.email]` and so
on (add `--show` to see the values), and records a drafted request. A broker has at most one open
request.

```sh
npx privacy-guard send broker-a
```

A dry run: prints what would be sent and sends nothing. `--show` works here too.

```sh
npx privacy-guard send broker-a --confirm
```

The confirmed send. It posts the broker's form and records the request as sent only when the
broker's answer carries a receipt reference. Then the due date is one calendar month after the sent
date. If no receipt comes back, the request stays drafted; check the broker's mail before sending
again. An agent cannot run this without your approval (see `.claude/hooks/deny-outward-send.sh`).

```sh
npx privacy-guard reply broker-a
npx privacy-guard reply broker-a 2026-11-03
```

Records the broker's reply, today or on the given date, and stops the clock.

```sh
npx privacy-guard report
```

Lists every overdue request, from the day after its due date, and every request still drafted.
Exits 1 when something is overdue, so it can drive a scheduled check.

## Trying it locally

Broker A is fictitious. Its stand-in runs on your machine:

```sh
npm run site
```

That serves broker A's opt-out page at `http://localhost:8080/` and answers the form with a
thank-you page and a fresh reference, so `send broker-a --confirm` can be tried end to end. It keeps
nothing that is submitted.

## Development

`npm test` runs the tests; `npm run lint` type-checks.
