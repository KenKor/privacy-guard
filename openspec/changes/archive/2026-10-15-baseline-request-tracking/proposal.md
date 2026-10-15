Ticket: none (baseline change: records the code as it is, no behaviour change)
PRD: none. `docs/prds/reviewed/opt-out-broker-a.md` plans the ticket changes that will modify this baseline.

# Proposal

## Why

Request tracking has code and tests on this branch but no living spec, so the first ticket change
for it would have nothing to write a delta against. This baseline records what the code does today,
including what it does not do yet, so that each ticket's change can show exactly what it alters.

## What Changes

- Adds a living spec for request tracking that describes the current behaviour of:
  - the ledger file (`src/ledger.ts`): where it lives, what an entry holds, how loading validates it;
  - request states and dates: the five stored states and the YYYY-MM-DD dates, of which only the due
    date is read, with no transitions and no due-date arithmetic;
  - the `due` command (`src/cli.ts`, `dueOn` in `src/ledger.ts`);
  - the send guard (`src/send.ts`) and the `send` command that uses it;
  - the command line around them: `draft` as a stub, usage on an unknown or missing command.
- Each scenario cites the test that covers it, or says no test does.
- No code, test or documentation changes. The tasks only check the spec against the code and tests.

## Capabilities

### New Capabilities
- `request-tracking`: the ledger of requests, their states and dates, the `due` query and command,
  and the guard every send goes through.

### Modified Capabilities
None. `openspec/specs/` is empty.

## Impact

- Adds `openspec/specs/request-tracking/spec.md` when the change is archived.
- No effect on code, the CLI, dependencies or the ledger format.
- Out of scope: the playbook (`src/playbook.ts`, `brokers/`) and the broker A form, which are not
  request tracking and get their own baseline if a ticket changes them.
- Must be archived before any ticket change that touches request tracking (CLAUDE.md, Spec layer).
