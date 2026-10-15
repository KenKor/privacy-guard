# Proposal

## Why

A due date on a Saturday or Sunday makes `report` call a broker overdue on a weekend, before the
broker has had the working day the EU time-limit rule (Regulation 1182/71, Article 3(4)) gives it.
Moving a weekend due date to the following Monday keeps the report fair to the broker while staying
simple: there is still no holiday calendar for any country.

## What Changes

- Due date: after the one-calendar-month arithmetic (clamped to the month's last day), a due date
  that falls on a Saturday or Sunday moves to the following Monday. This reverses the "no weekend
  shift" decision of `opt-out-broker-a`.
- Public holidays still do not move a due date.
- The due date is still computed once, when the request is marked sent, and stored in the ledger.
  Entries already in a ledger keep the due date they were stored with.
- **BREAKING** (behaviour only): requests sent on a date whose one-month mark falls on a weekend now
  get a due date one or two days later than before, so `send` prints, and `report` uses, the later
  date. The ledger format does not change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `deadline-tracking`: the "Due date" requirement moves weekend due dates to the following Monday;
  its weekend scenario and its shorter-month scenario change.

## Impact

- `src/ledger.ts`: `dueDate` and its doc comment.
- `test/ledger.test.ts`: the `dueDate` table and the `markSent` test that sends on 2027-01-31
  (2027-02-28 is a Sunday, so it becomes due 2027-03-01).
- `GLOSSARY.md`: the "Due date" entry.
- No change to the CLI surface, the ledger format, playbooks or sending.
