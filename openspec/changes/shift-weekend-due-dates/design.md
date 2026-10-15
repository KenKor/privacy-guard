# Design

## Context

`dueDate(sent)` in `src/ledger.ts` works on the date's parts (year, month, day) so no time zone can
shift the day, and returns the clamped one-month date. `markSent` stores its result in
`dates.due`; `overdue` and `report` read only the stored value. `opt-out-broker-a` chose no weekend
shift and recorded the risk that a request could be flagged one or two days early; this change
removes that risk for weekends. See proposal.md for why.

## Goals / Non-Goals

**Goals:**
- Weekend due dates move to Monday, computed without a time zone.

**Non-Goals:**
- Public holidays, in any country.
- Rewriting due dates already stored in a ledger.

## Decisions

- **Shift inside `dueDate`.** The weekend rule is part of what "due date" means, so `dueDate`
  returns the shifted date and `markSent`, `send` and `report` need no change. Alternative: a
  separate `shiftWeekend` step in `markSent`; rejected because every caller would have to remember
  it and the glossary defines a single due date.
- **Weekday from `Date.UTC`.** The weekday comes from `new Date(Date.UTC(y, m - 1, d)).getUTCDay()`,
  the same UTC-only approach the file already uses for `daysBetween` and `daysInMonth`. The shift
  adds 2 days for Saturday and 1 for Sunday, carrying across a month or year end (2027-02-28 →
  2027-03-01) by formatting the shifted UTC date back to its parts.
- **Stored due dates stay.** A due date is fixed when the receipt comes back, so a ledger read never
  changes what `send` already printed. Alternative: recompute `due` from `sent` on load; rejected
  because it makes the stored field a cache that can disagree with itself, and the only effect of
  keeping an old weekend date is to flag a request a day or two early, the behaviour this project
  had until now.

## Risks / Trade-offs

- [Holidays] → A due date on a public holiday is still not moved, so a request can be flagged up to
  a day early on a holiday, but never later than the strict rule allows. Documented in the glossary.
- [Old ledger entries] → An entry sent before this change and due on a weekend keeps that date and
  is reported overdue on the Sunday or Monday. The ledger is local and new; no action needed.

## Migration Plan

None. The ledger format is unchanged; old entries load and report as before. Rollback is reverting
the commit.
