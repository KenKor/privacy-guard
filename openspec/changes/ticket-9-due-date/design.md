# Design

## Context

`src/ledger.ts` stores dates as YYYY-MM-DD strings and compares them as text (`dueOn`); nothing in
`src/` computes a date, and the CLI's `today` is already a local calendar date (`localDate` in
`src/cli.ts`). The rule itself is D-6 in the PRD; see proposal.md for why it comes now and
`specs/request-tracking/spec.md` for the dates it must give.

## Goals / Non-Goals

**Goals:**
- One exported function, `dueDate(sent: string): string`, in `src/ledger.ts` (PRD plan item 3), that
  the later `send` and `receipt` tickets call.
- Tests for the PRD's six dates, both leap and non-leap February, and a time-zone check.

**Non-Goals:**
- Calling it from any command, or writing `dates.due` (#13, #17).
- Checking its input. Callers pass today's local date or a `dates.*` value that `loadLedger` has
  already checked for form; what it returns for a string that is not a real calendar date
  (`2026-13-45`) is not specified, and no test pins it.
- Overdue and days overdue (D-10, a later ticket).

## Decisions

- **Integer arithmetic on the string, no `Date`.** Split the string into year, month and day, add one
  to the month (December rolls over into January of the next year), clamp the day to the target
  month's length, and format back with zero padding. The month length comes from a twelve-entry table
  with February at 29 in a Gregorian leap year (divisible by 4, except centuries not divisible by 400).
  Alternatives: `new Date(y, m, d)` with `setMonth` rolls 31 January into March, which D-6 rejects, and
  reads the machine's time zone; `Date.UTC(y, m + 1, 0)` for the month length avoids the zone but
  still mixes in a `Date` for one number. The table keeps the function free of time zones by
  construction, which the ticket asks for.
- **Lives in `src/ledger.ts`**, next to `dueOn`, as the PRD's plan item 3 says; the ledger is where
  due dates are kept and read.
- **The header comment** on line 3 of `src/ledger.ts` changes from "Deadline logic ... is not here yet;
  whoever records an entry sets its due date" to say that `dueDate` works out the due date and that no
  command records one yet.
- **Tests** go in a new `describe("dueDate")` in `test/ledger.test.ts`, with the titles the delta spec
  cites. The time-zone test sets `process.env.TZ` to a zone behind UTC and one ahead of it, calls
  `dueDate`, and restores the old value.

## Risks / Trade-offs

- [A hand-written month table can be wrong for one month] → the tests cover a 31-to-30 day step
  (March, August), February in a common and a leap year, and the year rollover.
- [The century rule (2100 is not a leap year) has no test from the PRD's table] → accepted: no request
  sent this century reaches it; the rule is the standard one and costs one expression.
