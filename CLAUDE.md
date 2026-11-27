# privacy-guard

Asks data brokers to stop selling personal data (GDPR Articles 17 and 21) and tracks each request
against the one-month deadline. TypeScript on Node; `npm test` runs vitest. Sending is dry-run by
default. Not legal advice.

## Ticket or PRD
New work is a ticket (small, clear, one session) or a PRD that ends in tickets (big, uncertain,
open decisions). An intake goes to `docs/prds/new/`, then through `/triage` to `triaged/`.

## Scope

Users: one person on their own machine, who runs the `privacy-guard` command to send opt-out requests
and track them.

Supported: the commands in the README, on Node.js 22.18 or later, against the playbooks in `brokers/`
and the ledger file the tool writes itself.

Non-goals (a finding about these is recorded as `not filed`, never filed as a ticket):

- a ledger or playbook file edited into a shape the tool never writes, unless it loads without an
  error and gives a wrong result;
- brokers without a playbook;
- the speed of the test suite and of the practice site in `sites/`.

## Agent skills

### Issue tracker

Issues live in this repository's GitHub Issues, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Agents
| Agent | Use it for |
|---|---|
| `prd-author` / `prd-reviewer` / `prd-archiver` | write, verify, close out a PRD |
| `pr-reviewer` (+ correctness, perf-memory, reuse) | the merge gate |
| `healer` / `tester` | red tests; assertion changes under authority |
| `documenter` / `marketeer` | user docs; business case, when asked |
| `release-classifier` | the release label, flags and release note of one PR or issue (`/release classify <n>`) |
| `release-manager` | the release role: `/release status`, `notes`, `docs`, `candidate` |

## Release management
Phase 0 (shadow): labels are recorded, nothing is restricted. Settings and the supported contract:
`docs/agents/release.md`. Pull requests for the release add-on go into the `release` branch.

## Merging

The owner, 2026-11-27: a pull request in this repo that passes the merge gate is merged without
asking the owner. What goes in is chosen at triage and when the work is assigned and reviewed, not
at the merge. The gate is step 5 of `.claude/skills/build-loop/SKILL.md`, with the `required_check`
and `extra_gates` in `docs/agents/build-loop.md`; it holds for every pull request here, inside the
build loop or not. **`pr-reviewer` always reviews, and the squad too where the pull request changes
production code or a test (step 4.7); there, no squad, no merge.**
Whoever built the pull request merges it, with the settings' `merge_command`, `<sha>` being the head
the gate was checked on. Do not ask the owner whether to merge: this section is the standing
authorization that any "merge only with the user's authorization" rule here asks for. A design
decision, or a blocking finding that needs one, still goes to the owner, and the pull request waits.
The session that built a sweep pull request never merges it; the owner does, or the shepherd on the
owner's yes.

## Unattended roles
Three sessions keep this repo moving: the builder (`/build-loop`), the decider (`/decision-sweep`) and
the shepherd (`/shepherd`). Settings: `docs/agents/build-loop.md`, `decision-sweep.md`, `shepherd.md`;
the contract between them: `docs/agents/unattended-protocol.md`. Pull requests for the roles add-on
go into the `roles` branch.

## Docs
`docs/agents/` (rules, deviations, review checks), `docs/prds/index.md` (generated).

Background: [docs/background/personal-data.md](docs/background/personal-data.md) (what counts as personal data, and how to handle it).
