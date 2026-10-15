# deadline-tracking Specification

## Purpose

Holds each broker to the one-month deadline for its reply: works out due dates, lets the human
record replies, and reports requests whose deadline has passed.

## Requirements

### Requirement: Request states
A request in the ledger SHALL be in one of three stored states: `drafted`, `sent` or `acknowledged`.
Overdue SHALL NOT be stored; it is derived from the dates whenever the ledger is read. Loading a
ledger with any other state SHALL fail, naming the entry and the state.

#### Scenario: Stored overdue state
- **WHEN** the ledger has an entry with state `overdue`
- **THEN** loading it fails, naming the entry and listing the valid states

#### Scenario: Ledger holds no personal data
- **WHEN** a request has been drafted, sent and acknowledged
- **THEN** its ledger entry holds only the broker, the state, the dates and the receipt reference

### Requirement: Due date
The due date SHALL be the same day of the month, one calendar month after the sent date. When that
month has no such day, it SHALL be that month's last day. Weekends and public holidays SHALL NOT
move it.

#### Scenario: Ordinary month
- **WHEN** a request is sent on 2026-10-12
- **THEN** its due date is 2026-11-12

#### Scenario: Shorter next month
- **WHEN** a request is sent on 2027-01-31
- **THEN** its due date is 2027-02-28

#### Scenario: Leap year
- **WHEN** a request is sent on 2028-01-30
- **THEN** its due date is 2028-02-29

#### Scenario: Year boundary
- **WHEN** a request is sent on 2026-12-15
- **THEN** its due date is 2027-01-15

#### Scenario: Due date on a weekend
- **WHEN** a request is sent on 2026-10-14 and 2026-11-14 is a Saturday
- **THEN** its due date stays 2026-11-14

### Requirement: Overdue
A `sent` request SHALL be overdue from the day after its due date. An `acknowledged` or `drafted`
request is never overdue.

#### Scenario: On the due date
- **WHEN** a sent request is due 2026-11-12 and today is 2026-11-12
- **THEN** it is not overdue

#### Scenario: Day after
- **WHEN** a sent request is due 2026-11-12 and today is 2026-11-13
- **THEN** it is overdue by 1 day

#### Scenario: Reply recorded
- **WHEN** a request due 2026-11-12 was acknowledged and today is 2026-12-01
- **THEN** it is not overdue

### Requirement: Record a reply
`reply <broker> [YYYY-MM-DD]` SHALL mark the broker's `sent` request `acknowledged` with the given
reply date, or today when none is given. It SHALL refuse, changing nothing, when the broker has no
sent request, when the date is not a valid date, or when it is before the sent date or after today.

#### Scenario: Reply today
- **WHEN** broker-a's request was sent 2026-10-12 and `reply broker-a` runs on 2026-11-05
- **THEN** the request is `acknowledged` with reply date 2026-11-05

#### Scenario: Reply on a given date
- **WHEN** `reply broker-a 2026-11-03` runs on 2026-11-05
- **THEN** the request is `acknowledged` with reply date 2026-11-03

#### Scenario: Date before the send
- **WHEN** the request was sent 2026-10-12 and `reply broker-a 2026-10-01` runs
- **THEN** it refuses, exits 1, and the ledger is unchanged

#### Scenario: Date in the future
- **WHEN** `reply broker-a 2026-12-01` runs on 2026-11-05
- **THEN** it refuses, exits 1, and the ledger is unchanged

#### Scenario: Only drafted
- **WHEN** broker-a's request is still drafted and `reply broker-a` runs
- **THEN** it refuses, says the request was not sent, and exits 1

### Requirement: Report
`report` SHALL list every overdue request with its broker, sent date, due date and days overdue, and
every drafted request with its drafted date. It SHALL exit 1 when any request is overdue and 0
otherwise; drafted requests SHALL NOT affect the exit code. With nothing to list it SHALL say so.

#### Scenario: Overdue request
- **WHEN** broker-a's request was sent 2026-10-12, has no reply, and `report` runs on 2026-11-13
- **THEN** it prints `broker-a: sent 2026-10-12, due 2026-11-12, 1 day overdue` and exits 1

#### Scenario: Only a drafted request
- **WHEN** broker-a's only request is drafted since 2026-10-12 and `report` runs
- **THEN** it lists broker-a as drafted on 2026-10-12, not sent, and exits 0

#### Scenario: Nothing to report
- **WHEN** every request is acknowledged or sent and not yet overdue
- **THEN** it prints `nothing is overdue` and exits 0

### Requirement: Report replaces due
There SHALL be no `due` command; `report` takes its place.

#### Scenario: Old command
- **WHEN** `privacy-guard due` runs
- **THEN** it prints usage and exits 2
