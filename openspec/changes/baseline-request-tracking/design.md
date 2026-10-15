# Design

## Context

See proposal.md, Why. The behaviour lives in `src/ledger.ts` (file, validation, `dueOn`), `src/send.ts`
(the guard) and `src/cli.ts` (`due`, `draft`, `send`, usage), run through `bin/privacy-guard.js`. Tests:
`test/ledger.test.ts` and `test/cli.test.ts`; all 30 tests in the suite passed on this branch when the
spec was written. GLOSSARY.md defines Due date and Overdue as the product intends them, which is ahead
of the code.

## Goals / Non-Goals

**Goals:**
- A spec a ticket change can write MODIFIED and ADDED deltas against, line for line.
- Every scenario traceable to a test, or marked as having none.

**Non-Goals:**
- Fixing or testing any gap the spec exposes. Gaps go to tickets, not this change.
- The playbook and the broker A form.
- Describing the PRD's planned behaviour (`reply`, `escalate`, `receipt`, `report`, due-date arithmetic).

## Decisions

- **The code is the source, not the glossary or the PRD.** Where they differ, the spec says what the code
  does: due dates are recorded, not computed; `overdue` is a stored state, not derived. Alternative:
  spec the glossary meaning and mark it unmet. Rejected, because a baseline that already holds the
  intended behaviour leaves nothing for the ticket's delta to show.
- **Quirks are recorded as behaviour.** Format-only date checks (`2026-13-45` loads), an unchecked broker
  field, the stack trace on an invalid ledger and `send x --confirm` counting as confirmed are what the
  code does today. Listing them lets a ticket change them on purpose with a MODIFIED delta.
- **"Not done yet" is stated as SHALL NOT.** For example, no command writes the ledger, and a confirmed
  send fails. That makes the missing behaviour visible in the spec and a ticket's delta replaces it.
- **Each scenario carries a `Test:` line.** It names the file and the describe › it title, adds what the
  test does not assert, or says `none`. Scenarios with no test were confirmed by running the bin in a
  scratch directory; the check tasks re-run those.
- **One capability, `request-tracking`.** The ledger, `due` and the guard change together in the PRD's
  tickets. Splitting the guard out was considered; it has two tests and one caller, too small for its own spec.

## Risks / Trade-offs

- [The spec fixes quirks in place, so a reader may take them for intent] → design.md says they are
  recorded as found; a ticket that changes one uses a MODIFIED delta.
- [Code changes on the branch before archive make the baseline stale] → the check tasks run just before
  archive, and the change is archived before any ticket change (CLAUDE.md, Spec layer).
- [Exact output strings in scenarios are brittle] → they are the user-visible contract today; the tests
  already pin most of them.
