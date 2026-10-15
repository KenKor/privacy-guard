Ticket: #8
PRD: docs/prds/reviewed/opt-out-broker-a.md (D-10, D-11), plan item 2

# Proposal

## Why

Nothing tells the human when a broker has let its one-month deadline pass. `overdue` exists only as a
stored state that no command writes, so it is stale the moment a reply is recorded or a date corrected
(D-10), and `due` always exits 0, so a scheduled job cannot notice anything (D-11).

## What Changes

- **BREAKING** (ledger format): `overdue` is no longer a stored state. The states are `drafted`, `sent`,
  `acknowledged` and `escalated`. A ledger that still holds `overdue` fails to load with the existing
  unknown-state error, which names the file, the entry and the allowed states.
- Overdue is derived on every read: a request is overdue on a day when its state is `sent`, it has a due
  date, and that day is strictly after the due date. Days overdue counts calendar days from the due date.
- New `report` command: one line per overdue request
  (`broker-a: sent 2026-10-12, due 2026-11-12, 1 day overdue`), and a warning line for a `sent` request
  with no due date (`broker-x: sent 2026-09-01, no due date recorded`). Exit 1 when it prints either;
  otherwise `nothing is overdue` and exit 0. It reads the ledger only and sends nothing.
- The usage line lists `report`.
- `due` is unchanged in behaviour; its scenarios stop using the `overdue` state.
- `.claude/agents/tester.md`: the state machine reads "drafted, sent, acknowledged, escalated" with
  overdue named as derived, and the send tier tests against a local stub instead of "in dry-run"
  (PRD plan item 2).
- Test fixture: the `past-due` entry in `test/ledger.test.ts` changes state from `overdue` to `sent`;
  its `dueOn` expectation stays (PRD plan item 2 gives the authority).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `request-tracking`: the request states drop `overdue`; overdue becomes a derived condition; a new
  `report` command; the command line surface gains `report`; scenarios that used `overdue` as a stored
  state are rewritten.

## Impact

- Code: `src/ledger.ts` (`STATES`, an overdue query and days overdue), `src/cli.ts` (`report`, usage).
- Tests: `test/ledger.test.ts`, `test/cli.test.ts`.
- Agent docs: `.claude/agents/tester.md` lines 43 and 56.
- Ledger files: a hand-written ledger with an `overdue` entry must be edited to `sent` (or the state it
  really is in) before any command will read it. No code writes `overdue`, so only hand-edited ledgers
  are affected.
- Out of scope: the `report` line for a submission without a receipt (needs `dates.submitted`, arrives
  with the send ticket, plan item 7), the `report` line for an `escalated` request (arrives with
  `escalate`, D-1), and computing the due date from the sent date (plan item 3). Until then `report`
  says nothing about `drafted` or `escalated` entries.
