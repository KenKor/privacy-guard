# privacy-guard

Asks data brokers to stop selling personal data (GDPR Articles 17 and 21) and tracks each request
against the one-month deadline. TypeScript on Node; `npm test` runs vitest. Sending is dry-run by
default. Not legal advice.

## Ticket or PRD
New work is a ticket (small, clear, one session) or a PRD that ends in tickets (big, uncertain,
open decisions). An intake goes to `docs/prds/new/`, then through `/triage` to `triaged/`.

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

## Docs
`docs/agents/` (rules, deviations, review checks), `docs/prds/index.md` (generated).

Background: [docs/background/personal-data.md](docs/background/personal-data.md) (what counts as personal data, and how to handle it).
