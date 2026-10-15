# Tasks

Test names are the ones the spec's **Test** lines cite. Work each group test-first (`/tdd`).

## 1. Overdue is no longer a stored state

- [x] 1.1 In `test/ledger.test.ts` line 52, change the `past-due` fixture's state from `overdue` to `sent`, leaving the `dueOn` expectation on line 60 as it is (PRD plan item 2 authorises this assertion change); verify `npm test` still passes
- [x] 1.2 Add `ledger` › "rejects a stored overdue state", expecting `<path>: entry 0: state "overdue" is not one of drafted, sent, acknowledged, escalated`; verify it fails, then remove `overdue` from `STATES` in `src/ledger.ts` and verify it passes and `npm run lint` reports nothing

## 2. Overdue and days overdue

- [x] 2.1 Add `isOverdue` tests: "is not overdue on its due date, and is the day after" (due 2026-11-12, today 2026-11-12 and 2026-11-13), "never counts a drafted, acknowledged or escalated entry", "does not count a sent entry without a due date"; verify they fail, then add `isOverdue(entry, today)` to `src/ledger.ts` with a doc comment and verify they pass
- [x] 2.2 Add `daysOverdue` › "counts calendar days from the due date" covering 2026-11-12→2026-11-13 (1), 2026-10-30→2026-11-02 (3) and 2026-10-24→2026-10-26 (2, across the EU daylight-saving change); verify it fails, then add `daysOverdue(due, today)` using `Date.UTC` and verify it passes, also with `TZ=Europe/Amsterdam npm test`

## 3. The report command

- [x] 3.1 Add `privacy-guard report` tests in `test/cli.test.ts` with the names the spec cites: empty ledger; quiet on the due date and flagged the day after (also asserting the ledger file is byte-for-byte unchanged); several days overdue and ledger order with a warning in the middle; the warning alone; drafted and acknowledged never listed; a missing sent date left out; a stored `overdue` ledger stops `report` with the load error. The `run` helper's `today` is fixed at 2026-10-12, so give it an optional `today` parameter. Verify they fail
- [x] 3.2 Add `report` to `main` in `src/cli.ts`: one pass in ledger order printing the overdue line or the warning line, exit 1 when any line was printed, else `nothing is overdue` and exit 0; add `report` to `USAGE` and to the file's header comment; verify the 3.1 tests and the existing usage test pass

## 4. Agent docs

- [ ] 4.1 In `.claude/agents/tester.md` line 43, make the state machine "drafted, sent, acknowledged, escalated", naming overdue as derived from a `sent` request's due date; on line 56, replace "Test the send path against a local stub, in dry-run." with "Test the send path against a local stub (an injected `deliver`, or the local site on a free port), never a real broker."; verify by reading both lines against PRD plan item 2

## 5. Check

- [x] 5.1 Run `npm test` and `openspec validate ticket-8-report --strict`; verify both pass, and run `node bin/privacy-guard.js report` in an empty temp directory and verify it prints `nothing is overdue` and exits 0
- [x] 5.2 Check every **Test** line in the delta spec names a test that now exists under that name; fix the spec or the test name where they differ

## Workflow follow-up

- Finish with `/code-review` and `/pr`; close #8 through the PR and tick plan item 2 in the PRD.
- Archive with `/opsx:archive` after the PR merges, in merge order.
