# privacy-guard

Asks data brokers to stop selling personal data (GDPR Articles 17 and 21) and tracks each request
against the one-month deadline. TypeScript on Node; `npm test` runs vitest. Sending is dry-run by
default. Not legal advice.

## Ticket or PRD
New work is a ticket (small, clear, one session) or a PRD that ends in tickets (big, uncertain,
open decisions). An intake goes to `docs/prds/new/`, then through `/triage` to `triaged/`.
A ticket that changes behaviour also gets an OpenSpec change (see Spec layer).

## Agent skills

### Issue tracker

Issues live in this repository's GitHub Issues, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Spec layer

OpenSpec records behaviour; the PRD designs the work (why, decisions, plan) and links to the changes.
One change per ticket that changes behaviour, named after the ticket; its proposal.md starts with
`Ticket: #<n>` and `PRD: <path> (D-x)`. No change for docs, build or refactor tickets.
A capability that has code but no living spec gets a baseline change first: what the code does
today, checked against code and tests, no code changes; archive it before any ticket's change.
`/opsx:apply` works the tasks with `/tdd`; finish with `/code-review` and `/pr`. Archive with
`/opsx:archive` after the ticket's PR merges, in merge order. Living specs: `openspec/specs/`.

## Agents
| Agent | Use it for |
|---|---|
| `prd-author` / `prd-reviewer` / `prd-archiver` | write, verify, close out a PRD |
| `pr-reviewer` (+ correctness, perf-memory, reuse) | the merge gate |
| `healer` / `tester` | red tests; assertion changes under authority |
| `documenter` / `marketeer` | user docs; business case, when asked |

## Docs
`docs/agents/` (rules, deviations, review checks), `docs/prds/index.md` (generated).
