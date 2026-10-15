# Tasks

## 1. Ledger and deadlines

- [x] 1.1 Due-date arithmetic (clamped calendar month, no weekend shift) and verify with tests for every scenario in `deadline-tracking` "Due date"
- [x] 1.2 Ledger states become `drafted`, `sent`, `acknowledged`; add `reference` and `dates.replied`; loading a ledger with any other state fails naming the entry. Verify with `test/ledger.test.ts`
- [x] 1.3 Replace `dueOn` with an overdue query (overdue from the day after the due date, with days overdue) and verify with tests for the "Overdue" scenarios

## 2. Playbook and subject

- [x] 2.1 Move `reply.acknowledged_when` to a top-level `receipt` in `src/playbook.ts` and `brokers/broker-a.yaml`; validate `receipt`, the pattern compiling, and field value types. Verify with `test/playbook.test.ts`
- [x] 2.2 Contract test checks `receipt.selector` on the recorded page; verify `test/broker-a-form.test.ts` passes
- [x] 2.3 Subject file loader (`subject.yaml`, required keys, strings only, errors without values); add `subject.example.yaml` and `subject.yaml` to `.gitignore`. Verify with tests for the "Subject file" scenarios and `git check-ignore subject.yaml`
- [x] 2.4 Field rendering (placeholders, `| optional`, `true` → `on`, `false` left out, masked printout) and verify with tests for the "Field rendering" and "Subject values are masked in output" scenarios, including a test that no subject value from `subject.example.yaml` appears in masked output or errors

## 3. Draft, reply, report

- [x] 3.1 `CliEnv` gains the brokers directory, subject path and `deliver` seams; verify that the existing CLI tests still pass using them
- [x] 3.2 `draft <broker> [--show]` with one-open-request refusal and usage on a missing broker; verify with CLI tests for the "Draft a request" and "One open request per broker" scenarios
- [x] 3.3 `reply <broker> [date]` with its refusals; verify with CLI tests for the "Record a reply" scenarios
- [x] 3.4 `report` (overdue and drafted, exit codes) and remove `due`, including the bin smoke test, which now runs `report`. Verify with CLI tests for the "Report" scenarios

## 4. Confirmed send

- [x] 4.1 Form submission `deliver` over `fetch` (urlencoded, no redirects, 10-second timeout) returning `receipt`, `not-sent` or `unclear`; reference extracted only via `receipt.selector` and the pattern. Verify with tests against a local test HTTP server for each "Sent only with a receipt" scenario, the redirect scenario, and an answer containing injected instructions
- [x] 4.2 `send <broker> [--confirm] [--show]` for one broker: dry run, refusal without a drafted request, ledger update only on a receipt, messages per outcome. Verify with CLI tests for the "Sending is a dry run unless confirmed" scenarios and the ledger after each outcome
- [x] 4.3 Move `node-html-parser` to dependencies; verify `npm ls node-html-parser` lists it outside dev
- [x] 4.4 Hook pattern covers `privacy-guard.js send` and quoted paths; verify `.claude/hooks/deny-outward-send.sh --selftest` passes with new cases for `node bin/privacy-guard.js send` and `./bin/privacy-guard.js send`

## 5. Local site

- [x] 5.1 `scripts/site.ts`: serve the page on `localhost:8080`, answer `POST /` with a fresh `BA-nnnnnn` in `#thanks`, keep nothing; point `npm run site` at it. Verify with a test that starts the server on a free port and checks GET, POST and 404, and that submitted values are not logged

## 6. Docs and integration

- [x] 6.1 README usage: subject file, `draft`, `send`, `reply`, `report`, `npm run site`. Verify that every documented command runs as written against `subject.example.yaml` and the local site, with the human making the confirmed send
- [x] 6.2 End to end against the local site: draft, dry run, confirmed send, `report` on the due date and the day after, `reply`. Verify with `npm test`, `npm run lint` and the hook selftest all passing

## Workflow follow-up

- Remove `docs/prds/triaged/opt-out-broker-a.md` and regenerate `docs/prds/index.md` (done in the commit that creates this change).
- Finish with `/code-review` and `/pr`, then `/opsx:archive` to merge the deltas into `openspec/specs/`.
