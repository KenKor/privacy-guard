# Design

## Context

See proposal.md for why. The skeleton already has these pieces:

- `src/cli.ts`: `due`, a stub `draft`, and `send`, which sends every drafted entry through
  `guardedSend` to a `deliver` that always throws.
- `src/send.ts`: `guardedSend`, the dry-run gate. Its `Deliver` returns nothing.
- `src/ledger.ts`: `STATES` including `overdue` and `escalated`, `dueOn`, and no due-date
  arithmetic. The ledger already holds no personal data.
- `src/playbook.ts`: loads and validates `brokers/*.yaml`. `reply.acknowledged_when` is optional and
  not validated.
- `.claude/hooks/deny-outward-send.sh`: blocks agent tool calls that match
  `privacy-guard[[:space:]]+send` unless they have `--confirm` and the one-shot marker. It misses
  `privacy-guard.js send`.
- `npm run site`: `python3 -m http.server`, which can't answer a POST. Broker A's page makes up a
  reference in the browser, and its static `#thanks` already contains `BA-000000`.

Requirements are in `specs/request-sending`, `specs/deadline-tracking` and `specs/local-broker-site`.

## Goals / Non-Goals

**Goals:**
- Keep everything about broker A in `brokers/broker-a.yaml`. Nothing in `src/` names a broker A
  field.
- Make the CLI testable without the network or the clock. The tests inject the date, file paths and
  the HTTP call.

**Non-Goals:**
- A browser engine. Forms that need JavaScript to submit are not supported.
- Retries. A failed or unclear send is left to the human (see Risks).

## Decisions

**Submit with Node's `fetch`, not a headless browser.** `fetch(form.url, { method: "POST", body:
URLSearchParams, redirect: "manual", signal: AbortSignal.timeout(10_000) })`. Broker A's form is
plain HTML. A browser engine would add a large dependency for nothing.
`redirect: "manual"` turns a 3xx into a status we treat as "not sent".

**Classify the answer into three outcomes.** `deliver` returns one of:
- `receipt(reference)`: a 2xx answer whose `receipt.selector` text matches the pattern.
- `not-sent(reason)`: a non-2xx status, or a network error before any answer (such as a refused
  connection).
- `unclear`: a 2xx answer without a matching reference, or a timeout.

A timeout counts as unclear because we can't tell whether the body arrived. `guardedSend` stays the
only path to `deliver` and passes its result through. The CLI maps the outcome onto the ledger: only
`receipt` changes the state. The alternatives were a separate "submitted" state, or counting unclear
sends as sent. Both were rejected in the grilling: no new state or commands, and an unclear send
must not start a clock on its own.

**Read the answer with `node-html-parser`, at runtime.** It is already used by the contract test, so
it moves from devDependencies to dependencies. Only `querySelector(receipt.selector).text` is
matched against the pattern. Nothing else from the answer is kept, printed or passed along.

**Render, then print or post.** A rendering module turns `form.fields` and the subject into an
ordered list of `{ name, value, source }`, where `source` says whether the value is literal or from
the subject. The same list feeds the masked printout and the POST body, so what is printed is what
is sent. `true` becomes `on`, and `false` is left out.

**The subject file is YAML, every value a string.** Parsed with the `yaml` package that is already a
dependency. Non-string values are refused because an unquoted `0612345678` parses as a number and
loses its leading zero. Paths default to `subject.yaml` and `brokers/` and are part of `CliEnv`, so
tests point them at `subject.example.yaml` and temporary directories.

**Due date: clamped calendar month, in pure date arithmetic.** It works on `YYYY-MM-DD` parts:
month + 1, with the day clamped to that month's length. It doesn't use `Date` with a time zone, so a
local midnight can't shift the day. Overdue is `today > due`, compared as ISO strings.

**Ledger entry shape.** `{ broker, state, reference?, dates: { drafted, sent?, due?, replied? } }`.
`dates.acknowledged` is renamed `replied`, because the date is when the broker replied.
`STATES` becomes `["drafted", "sent", "acknowledged"]`. `dueOn` is replaced by an `overdue(ledger,
today)` query that returns days overdue.

**`report` replaces `due`.** On the due date itself, `due` would list a request that isn't overdue
yet, which contradicts the overdue rule. Removing `due` also changes the bin smoke test, which runs
`due`.

**Hook pattern.** It becomes `privacy-guard(\.js)?["']?[[:space:]]+send`, so it covers `npx
privacy-guard send`, `node bin/privacy-guard.js send`, `./bin/privacy-guard.js send` and a quoted
path. The selftest gains a case for each.

**Local site: a Node server with no dependencies, in `scripts/site.ts`.** It runs with Node's type
stripping, as `bin/` does, and listens on `localhost:8080`. `GET /` serves
`sites/broker-a/index.html`. A `POST /` drains the body without reading or logging it, and answers
a small thank-you page with `<p id="thanks">… <strong id="reference">BA-nnnnnn</strong></p>`.
Everything else gets 404. `npm run site` points at it. The page itself stays unchanged, so the
contract test fixture stays identical to it.

## Risks / Trade-offs

- [The broker received a send we recorded as drafted (timeout, or no reference)] → `send` says so
  and exits 1, and `report` keeps listing the drafted request. There's no way to record a receipt
  by hand, so that request's deadline goes untracked until a later change adds one.
- [Sending again after an unclear send makes a duplicate request] → The message says to check broker
  A's mail first. The human decides.
- [A static reference is taken as a receipt] → Broker A's own page has `BA-000000` in `#thanks`. A
  broker that ignores the POST and returns its form page would be recorded as sent with a reference
  it never issued. Not handled in this change. A candidate fix is to accept only a reference that
  doesn't appear in the page as served by `GET`.
- [Agents can't dry-run `send`] → The hook blocks every agent `send` without `--confirm`, including
  dry runs. Agents use `draft`, which prints the same submission. Unchanged from today.
- [The hook is a tripwire, not a wall] → Agents can still evade it by sending from a script. It
  remains one of several layers, as documented in the hook.
- [Weekend due dates] → No shift is applied, so a request can be flagged one or two days earlier
  than the strict EU rule (Regulation 1182/71) would allow, but never later.

## Migration Plan

- The ledger is local and git-ignored. A ledger holding `overdue` or `escalated`, or
  `dates.acknowledged`, fails to load with a message naming the entry. No such ledgers are known.
- `brokers/broker-a.yaml`: `reply.acknowledged_when` moves to `receipt`. It's the only playbook.
- Remove `docs/prds/triaged/opt-out-broker-a.md`. It becomes this change, and the PRD index is
  regenerated.
