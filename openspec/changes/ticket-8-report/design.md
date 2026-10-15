# Design

## Context

`src/ledger.ts` holds `STATES` (with `overdue`), `loadLedger` (which rejects an unknown state naming
file, entry and the allowed states), `dueDate` (one calendar month after a sent date, ticket #9) and
`dueOn`. `src/cli.ts` dispatches `due`, `draft` and `send` from one `switch`, with `CliEnv` injecting
`ledgerPath`, `today` (a local `YYYY-MM-DD` date) and `print`. No code writes `overdue`; its only stored
use is the `past-due` fixture in `test/ledger.test.ts`. See proposal.md for why; see
specs/request-tracking/spec.md for the behaviour.

## Goals / Non-Goals

**Goals:**
- One place that says what overdue means, used by `report` now and by `escalate` later (D-1 accepts only
  an overdue `sent` entry).
- `report` testable through `main` with an injected `today`, like `due`.

**Non-Goals:**
- Using `dueDate` in `report`: `report` judges the due date the entry records. Recording a computed due
  date belongs to the send ticket.
- `report` lines for a submission without a receipt (item 7) or for an `escalated` request (D-1).
- Changing `due`, `dueOn`, or `send`.
- Checking that a date is a real calendar date (the spec keeps "only the form is checked").

## Decisions

- **Overdue predicate in `src/ledger.ts`.** `isOverdue(entry, today)` is true when the state is `sent`,
  `dates.due` is set and `dates.due < today`, beside `dueOn`. Text comparison of `YYYY-MM-DD` matches
  `dueOn`'s and needs no date parsing. A per-entry predicate rather than a list query like `dueOn`:
  `report` needs a per-entry answer to interleave warnings (below), and `escalate` (D-1) asks about one
  broker's entry.
- **`daysOverdue(due, today)` in `src/ledger.ts`.** Splits each date into year, month, day and subtracts
  `Date.UTC` values, divided by 86 400 000. UTC has no daylight-saving shifts, so the count is exact in
  every time zone. Alternative: `new Date("2026-11-12")` arithmetic in local time, which gives 23- or
  25-hour days across a DST change and a fractional count.
- **`report` in `src/cli.ts`.** One pass over the loaded entries in ledger order: an overdue entry gives
  the overdue line, a `sent` entry without `dates.due` gives the warning line. Exit 1 when any line was
  printed. A single pass keeps the overdue lines and warnings interleaved in ledger order, as the spec
  asks; two filtered lists would group them instead.
- **Wording.** `1 day overdue`, `2 days overdue`: the PRD shows only the singular; the plural is the
  obvious reading. A missing `dates.sent` (allowed: no date is required) is left out of the line
  (`broker-a: sent, due ...`) instead of printing `undefined`.
- **Stored `overdue` needs no migration code.** Removing it from `STATES` makes `loadLedger` reject it
  with the existing message (PRD, Due date and overdue). The `State` type loses `overdue` with it.
- **Usage line** becomes `usage: privacy-guard <due | report | draft | send [--confirm]>`; the header
  comment of `src/cli.ts` lists `report`.

## Risks / Trade-offs

- [A hand-written ledger with `overdue` stops every command] → The error names the file, the entry and
  the allowed states, so the fix is one edit; no code ever wrote `overdue`.
- [A malformed but well-formed date such as `2026-13-45` gives a nonsense day count] → Out of scope:
  the spec checks only the form of a date; `Date.UTC` rolls it over rather than throwing, so `report`
  still prints and exits 1.
- [`escalated` and drafted-with-submission entries are silent in `report` until later tickets] →
  Stated in the proposal; no command writes either yet, so only a hand-written ledger can hold them.
- [The overdue rule lives beside `dueOn`, whose rule differs (any non-acknowledged state, `<=`)] →
  Name and doc comment each query by what it answers; `due` is explicitly unchanged (D-11).
