# Spec Delta

## ADDED Requirements

### Requirement: Due date of a request
The due date of a request SHALL be one calendar month after its sent date, on the same day of the
month; when the target month has no such day, it SHALL be the last day of that month, never a day of
the month after. It SHALL be worked out from the YYYY-MM-DD text of a real calendar date, with no time
zone involved, and never as a count of days.

#### Scenario: Same day next month
- **WHEN** a request is sent on 2026-10-12
- **THEN** its due date is 2026-11-12
- **Test**: `test/ledger.test.ts` › dueDate › "is one calendar month after the sent date"

#### Scenario: Across the year end
- **WHEN** a request is sent on 2026-12-15
- **THEN** its due date is 2027-01-15
- **Test**: `test/ledger.test.ts` › dueDate › "is one calendar month after the sent date"

#### Scenario: End of January in a common year
- **WHEN** a request is sent on 2026-01-31
- **THEN** its due date is 2026-02-28
- **Test**: `test/ledger.test.ts` › dueDate › "is the last day of the target month when it has no such day"

#### Scenario: End of January in a leap year
- **WHEN** a request is sent on 2028-01-31
- **THEN** its due date is 2028-02-29
- **Test**: `test/ledger.test.ts` › dueDate › "is the last day of the target month when it has no such day"

#### Scenario: Into a 30-day month
- **WHEN** a request is sent on 2026-03-31 or on 2026-08-31
- **THEN** its due date is 2026-04-30 or 2026-09-30
- **Test**: `test/ledger.test.ts` › dueDate › "is the last day of the target month when it has no such day"

#### Scenario: Not the machine's time zone
- **WHEN** the due date of a request sent on 2026-10-12 is worked out on a machine whose time zone is behind or ahead of UTC
- **THEN** it is 2026-11-12
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
