# Tasks

Test first (`/tdd`): each test is written and seen to fail before the code that makes it pass.

## 1. Due date

- [ ] 1.1 In `test/ledger.test.ts`, add `describe("dueDate")` with "is one calendar month after the sent date" (2026-10-12 → 2026-11-12, 2026-12-15 → 2027-01-15); verify it fails because `dueDate` is not exported
- [ ] 1.2 Add `dueDate(sent: string): string` to `src/ledger.ts` with integer arithmetic on the string, no `Date` (design.md, Decisions); verify 1.1 passes
- [ ] 1.3 Add "is the last day of the target month when it has no such day" (2026-01-31 → 2026-02-28, 2028-01-31 → 2028-02-29, 2026-03-31 → 2026-04-30, 2026-08-31 → 2026-09-30); verify it fails before the clamp and passes after it
- [ ] 1.4 Add "does not depend on the time zone", which sets `process.env.TZ` to `America/Los_Angeles` and to `Pacific/Kiritimati`, expects 2026-11-12 for 2026-10-12 in both, and restores `TZ`; verify it passes
- [ ] 1.5 Replace the comment on line 3 of `src/ledger.ts` so it says `dueDate` works out the due date (one calendar month, clamped) and no command records one yet; verify by reading it against the delta spec's Request dates requirement

## 2. Whole change

- [ ] 2.1 Verify no 30-day arithmetic: `grep -rnE "86400|setDate|setMonth|new Date|\+ *30\b" src/ledger.ts` finds nothing (`src/cli.ts` keeps its `new Date()` for today), and reading `dueDate` shows its only 30s are month lengths in the table
- [ ] 2.2 Run `npm test` and verify it passes, with the cited tests under `test/ledger.test.ts` › dueDate
- [ ] 2.3 Run `openspec validate ticket-9-due-date --strict` and verify it passes, and `git diff --stat openspec-brownfield...HEAD -- src test` shows only `src/ledger.ts` and `test/ledger.test.ts`

## Workflow follow-up

- Review with `/code-review` and open the PR with `/pr`, closing #9 and checking off PRD plan item 3.
- After the PR merges, archive with `/opsx:archive`, in merge order, and verify
  `openspec/specs/request-tracking/spec.md` has the Due date of a request requirement.
