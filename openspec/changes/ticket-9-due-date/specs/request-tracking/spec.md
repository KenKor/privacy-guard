# Spec Delta

## ADDED Requirements

### Requirement: Due date rule
For a sent date, `dueDate` SHALL give the date one calendar month later, on the same day of the month;
when the target month has no such day, the last day of that month, never a day of the month after. It
SHALL work on the YYYY-MM-DD text of a real calendar date, with no time zone, and never count days. No
command uses it yet, so it sets no request's due date.

#### Scenario: Same day next month
- **WHEN** `dueDate` is given 2026-10-12
- **THEN** it gives 2026-11-12
- **Test**: `test/ledger.test.ts` › dueDate › "is one calendar month after the sent date"

#### Scenario: Across the year end
- **WHEN** `dueDate` is given 2026-12-15
- **THEN** it gives 2027-01-15
- **Test**: `test/ledger.test.ts` › dueDate › "is one calendar month after the sent date"

#### Scenario: End of January in a common year
- **WHEN** `dueDate` is given 2026-01-31
- **THEN** it gives 2026-02-28
- **Test**: `test/ledger.test.ts` › dueDate › "is the last day of the target month when it has no such day"

#### Scenario: End of January in a leap year
- **WHEN** `dueDate` is given 2028-01-31
- **THEN** it gives 2028-02-29
- **Test**: `test/ledger.test.ts` › dueDate › "is the last day of the target month when it has no such day"

#### Scenario: End of January in a century year that is not a leap year
- **WHEN** `dueDate` is given 2100-01-31
- **THEN** it gives 2100-02-28
- **Test**: `test/ledger.test.ts` › dueDate › "does not make a century year a leap year unless it divides by 400"

#### Scenario: Into a 30-day month
- **WHEN** `dueDate` is given 2026-03-31 or 2026-08-31
- **THEN** it gives 2026-04-30 or 2026-09-30
- **Test**: `test/ledger.test.ts` › dueDate › "is the last day of the target month when it has no such day"

#### Scenario: Not the machine's time zone
- **WHEN** `dueDate` is given 2026-10-12 on a machine whose time zone is behind or ahead of UTC
- **THEN** it gives 2026-11-12
- **Test**: `test/ledger.test.ts` › dueDate › "does not depend on the time zone"

## MODIFIED Requirements

### Requirement: Request dates
Every value in an entry's `dates` SHALL be a string of the form YYYY-MM-DD, under any key name; no date is
required, and whether it is a real calendar date is not checked. Commands read only `dates.due`.
No command records a computed due date yet: the due date is whatever was recorded, and an entry without
one is never due.

#### Scenario: No due date
- **WHEN** an entry in state `drafted` has only a drafted date
- **THEN** it is never listed as due
- **Test**: `test/ledger.test.ts` › dueOn › "returns open entries due on or before today" (the `no-date` entry)

#### Scenario: Sent date does not set a due date
- **WHEN** an entry in state `sent` has a sent date and no due date
- **THEN** no due date is derived from the sent date and the entry is never listed as due
- **Test**: none
