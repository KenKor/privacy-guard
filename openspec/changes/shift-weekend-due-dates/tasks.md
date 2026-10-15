# Tasks

## 1. Weekend shift in the due date

- [x] 1.1 Update the `dueDate` table in `test/ledger.test.ts` to every "Due date" scenario in the `deadline-tracking` delta (Saturday, Sunday, clamped month end on a weekend, public holiday, shorter month now 2026-08-31 → 2026-09-30), and change the `markSent` test's expected due date for a 2027-01-31 send to 2027-03-01. These assertion changes are authorised by this task. Verify the new rows fail against the current `dueDate`
- [x] 1.2 Move a Saturday or Sunday due date to the following Monday inside `dueDate` in `src/ledger.ts`, using UTC dates only as in design.md, and update its doc comment. Verify `npm test` passes
- [x] 1.3 Add a `report` test in `test/cli.test.ts` for the "Due date stored before this rule" scenario: a ledger entry sent 2026-10-14 with stored due 2026-11-14 is reported 1 day overdue on 2026-11-15. Verify it passes without further code changes
- [x] 1.4 Update the "Due date" entry in `GLOSSARY.md`: a weekend due date moves to the following Monday; public holidays do not move it. Verify no other doc still says weekends do not move it (`grep -rni weekend` outside `openspec/changes/archive`)

## Workflow follow-up

- Review with `/code-review`, open the PR with `/pr`.
- Archive with `/opsx:archive` to merge the delta into `openspec/specs/deadline-tracking/spec.md`.
