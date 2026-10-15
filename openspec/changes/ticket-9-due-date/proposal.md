Ticket: #9
PRD: docs/prds/reviewed/opt-out-broker-a.md (D-6)

# Proposal

## Why

A broker has one calendar month from receiving a request to answer it (GDPR Article 12(3)), but
privacy-guard cannot work out that date: today whoever writes a ledger entry sets `dates.due` by hand.
The coming `send` and `receipt` work (#13, #15) records a due date from the sent date, so the rule for
it is settled and tested first, on its own (D-6).

## What Changes

- The due date of a request is one calendar month after its sent date; when the target month has no
  such day, it is the last day of that month (D-6: never later than the law allows). Worked out on the
  `YYYY-MM-DD` text, with no time zone involved, and never as a count of 30 days.
- The rule is tested on the PRD's table: 2026-10-12 → 2026-11-12, 2026-12-15 → 2027-01-15,
  2026-01-31 → 2026-02-28, 2028-01-31 → 2028-02-29, 2026-03-31 → 2026-04-30, 2026-08-31 → 2026-09-30.
- The ledger module's header comment, which says deadline logic is not there yet, is updated.
- No command uses the rule yet: `due`, `send` and the ledger file behave as before, and a due date is
  still whatever the ledger records.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `request-tracking`: adds the rule for a request's due date, and changes the Request dates
  requirement, which says privacy-guard computes no date, to say that no command records a computed
  due date yet.

## Impact

- `src/ledger.ts`: a new exported due-date function and the updated header comment.
- `test/ledger.test.ts`: tests for the six dates above.
- No change to the CLI, the ledger format, `dueOn`, dependencies or other modules.
- Out of scope: writing `dates.due` from `send` or `receipt` (#13, #15), and overdue as a derived
  state (D-10).
