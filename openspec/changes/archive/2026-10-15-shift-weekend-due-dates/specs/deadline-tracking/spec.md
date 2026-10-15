# Spec Delta

## MODIFIED Requirements

### Requirement: Due date
The due date SHALL be the same day of the month, one calendar month after the sent date. When that
month has no such day, it SHALL be that month's last day. When the resulting day is a Saturday or a
Sunday, the due date SHALL be the following Monday. Public holidays SHALL NOT move it. The due date
SHALL be worked out when the request is sent and stored; a due date already in the ledger SHALL NOT
be recomputed.

#### Scenario: Ordinary month
- **WHEN** a request is sent on 2026-10-12
- **THEN** its due date is 2026-11-12

#### Scenario: Shorter next month
- **WHEN** a request is sent on 2026-08-31
- **THEN** its due date is 2026-09-30

#### Scenario: Leap year
- **WHEN** a request is sent on 2028-01-30
- **THEN** its due date is 2028-02-29

#### Scenario: Year boundary
- **WHEN** a request is sent on 2026-12-15
- **THEN** its due date is 2027-01-15

#### Scenario: Due date on a weekend
- **WHEN** a request is sent on 2026-10-14 and 2026-11-14 is a Saturday
- **THEN** its due date is Monday 2026-11-16

#### Scenario: Due date on a Sunday
- **WHEN** a request is sent on 2026-10-15 and 2026-11-15 is a Sunday
- **THEN** its due date is Monday 2026-11-16

#### Scenario: Last day of a shorter month on a weekend
- **WHEN** a request is sent on 2027-01-31 and 2027-02-28 is a Sunday
- **THEN** its due date is Monday 2027-03-01

#### Scenario: Due date on a public holiday
- **WHEN** a request is sent on 2026-11-25 and 2026-12-25, a Friday, is Christmas Day
- **THEN** its due date stays 2026-12-25

#### Scenario: Due date stored before this rule
- **WHEN** the ledger holds a sent request due 2026-11-14, stored before weekends moved due dates, and `report` runs on 2026-11-15
- **THEN** it is listed as due 2026-11-14 and 1 day overdue
