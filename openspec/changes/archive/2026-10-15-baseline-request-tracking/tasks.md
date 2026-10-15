# Tasks

Checks only. No code, test or documentation changes; a mismatch is fixed in the spec, or raised as a ticket
if the code is wrong. Run the "none" checks with the bin (`node <repo>/bin/privacy-guard.js ...`) from a
fresh scratch directory, never the repo root, so no real `ledger.json` is touched.

## 1. Cited tests

- [x] 1.1 Run `npm test` and verify it passes, with every test the spec cites present under the cited describe › it title in `test/ledger.test.ts` or `test/cli.test.ts`
- [x] 1.2 For each cited test, read its assertions and verify they cover the scenario's WHEN/THEN, apart from the gaps its `Test:` line names

## 2. Ledger, states and dates

- [x] 2.1 Read `src/ledger.ts` and verify the Ledger file, Ledger entry, well-formed and valid-entry requirements match it (file name, missing file read as empty, error texts, five states, YYYY-MM-DD check)
- [x] 2.2 Verify `git check-ignore ledger.json` reports `.gitignore` as the reason
- [x] 2.3 In a scratch directory, verify the untested ledger scenarios: an entry without `broker` loads; `null` and `[1]` fail with `expected an "entries" array`; a numeric `dates.due` fails naming `dates.due`; `2026-13-45` and an unknown date name load
- [x] 2.4 Verify by reading `src/` that no code computes a date or changes a state, and that nothing outside `saveLedger` writes the ledger (`grep -rn "saveLedger\|writeFileSync" src/` shows only the definition)

## 3. The due command

- [x] 3.1 Read `dueOn` and `due` in `src/ledger.ts` and `src/cli.ts` and verify the due rule, the ledger order, the output line `<broker>: <state>, due <date>` and exit 0 match the spec
- [x] 3.2 In a scratch directory, verify a `drafted` and an `escalated` entry with a past due date are listed, and a `sent` entry with no due date is not
- [x] 3.3 Verify `today` comes from the local date (`localDate` in `src/cli.ts` uses `getFullYear`/`getMonth`/`getDate`, not the UTC getters)
- [x] 3.4 In a scratch directory with `null` in `ledger.json`, verify `due` exits 1 with the load error and a stack trace

## 4. Send guard and send command

- [x] 4.1 Read `src/send.ts` and `send` in `src/cli.ts` and verify the guard, the dry-run lines, the not-implemented message and the exit codes match the spec
- [x] 4.2 In a scratch directory, verify: a ledger with only non-drafted entries prints `no drafted requests to send.`; `send --confirm` with nothing drafted prints that line without the dry-run line and exits 0; with two drafted entries it names only the first and exits 1
- [x] 4.3 In a scratch directory, verify `send x --confirm` is a confirmed send and `--confirm send` prints usage and exits 2
- [x] 4.4 Verify `ledger.json` is byte-identical before and after `send` and `send --confirm` (`sha256sum` before and after)

## 5. Command line and whole change

- [x] 5.1 Verify `draft` prints `draft is not implemented yet` and exits 0, and that running the bin with no arguments prints the usage line and exits 2
- [x] 5.2 Run `openspec validate baseline-request-tracking --strict` and verify it passes, and `git diff --stat main...HEAD -- src test bin` shows no change from this change

## Workflow follow-up

- Review with `/code-review` and open the PR with `/pr`.
- After the PR merges, archive with `/opsx:archive` before any ticket's change touching request tracking, and verify `openspec/specs/request-tracking/spec.md` exists with this Purpose.
