# Proposal

## Why

Broker A sells a subject's name, email, phone and job title, and accepts requests only through its
web form (issue #2). privacy-guard can't yet send anything or tell when a broker has missed its
deadline. This change is the first full path: draft the request, send it only on a confirmed send,
and flag the request once the one-month deadline has passed without a reply.

## What Changes

- `draft <broker>` renders the broker's playbook against the subject file, prints the submission
  (subject values masked unless `--show`), and records a drafted request in the ledger. It refuses
  when the broker already has a request that is not acknowledged.
- `send <broker> [--confirm] [--show]` sends one broker's drafted request. Without `--confirm` it is
  a dry run. With `--confirm` it posts the web form (no redirects followed, 10-second timeout). A
  request is sent only when the broker's answer carries a receipt reference; otherwise it stays
  drafted and `send` says the request may have arrived. **BREAKING**: `send` takes a broker and no
  longer sends every drafted request at once.
- `reply <broker> [date]` records the broker's reply and stops the clock.
- `report` lists overdue requests (from the day after the due date) and exits 1 when there are any.
  It also lists drafted requests for information. **BREAKING**: replaces `due`.
- Due date: one calendar month after the sent date, clamped to the end of the month, with no shift
  for weekends or holidays.
- Ledger: the stored states become `drafted`, `sent` and `acknowledged`. Overdue is worked out when
  the ledger is read, and `escalated` is dropped. Sent requests carry the receipt reference.
- Playbook: `reply.acknowledged_when` becomes a top-level `receipt { selector, reference_pattern }`,
  required for `web-form` playbooks.
- Subject file: a git-ignored `subject.yaml` and a committed, made-up `subject.example.yaml`.
- The outward-send hook catches the ordinary ways of running the CLI's `send` (through `npx`,
  `npm exec` or the bin file, quoted or not), not only `privacy-guard send`. It stays a tripwire,
  not a wall.
- `npm run site` becomes a local server that answers broker A's form POST with a thank-you page and
  a fresh reference.

Out of scope: escalation to a supervisory authority, recording what kind of reply it was, the
Art. 12(3) extension, re-requests (`cadence`), other brokers, and a way to record a receipt by hand.

## Capabilities

### New Capabilities

- `request-sending`: playbooks, the subject file, drafting, the confirmed send and its guard,
  receipts, and keeping personal data out of output.
- `deadline-tracking`: due dates, overdue, recording replies, and the report.
- `local-broker-site`: the local stand-in for broker A that answers a form submission, so a send can
  be tried end to end.

### Modified Capabilities

None. `openspec/specs/` is empty.

## Impact

- Code: `src/cli.ts` (commands), `src/ledger.ts` (states, reference, due-date arithmetic, overdue),
  `src/playbook.ts` (`receipt`, validation), `src/send.ts` (`deliver` returns the broker's answer),
  plus new modules for the subject file, field rendering and form submission.
- Data: `brokers/broker-a.yaml` (`receipt` block), `.gitignore` (`subject.yaml`), new
  `subject.example.yaml`.
- Tooling: `.claude/hooks/deny-outward-send.sh` (pattern and selftest), `package.json` (`site`
  script), a new local server for `sites/broker-a/`.
- Tests: `test/cli.test.ts` (the `send` and `due` tests change), `test/broker-a-form.test.ts`
  (`receipt`), new tests for each requirement.
- Docs: `README.md` (usage), `GLOSSARY.md` (already updated in this change).
- Dependencies: `node-html-parser` moves from devDependencies to dependencies, because `send` now
  reads the broker's answer at runtime. Node's own `fetch` and `http` cover the rest.
