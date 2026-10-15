# privacy-guard

Asks data brokers to stop selling personal data (GDPR Articles 17 and 21) and tracks each request
against the one-month deadline. TypeScript on Node; `npm test` runs vitest. Sending is dry-run by
default. Not legal advice.

## Ticket or OpenSpec change
This branch uses OpenSpec as its spec layer instead of PRDs. New work is a ticket (small, clear,
one session) or an OpenSpec change in `openspec/changes/<name>/` (big, uncertain, open decisions).
An intake goes to `docs/prds/new/`, then through `/triage` to `triaged/`; a triaged intake that
needs a design becomes a change, and nothing moves to `docs/prds/designed/`.

## Agent skills

### Issue tracker

Issues live in this repository's GitHub Issues, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Spec layer

OpenSpec. Grill first (`/grill-with-docs`); where the matt skills say /to-spec, use `/opsx:propose`.
tasks.md stays the task list; use /to-tickets only for parallel or blocked work. `/opsx:apply`
works each task with `/tdd`; finish with `/code-review` and `/pr`. `/opsx:archive` closes a change
and merges its deltas into the living specs, `openspec/specs/`.

## Agents
| Agent | Use it for |
|---|---|
| `prd-author` / `prd-reviewer` / `prd-archiver` | not used on this branch: OpenSpec replaces the PRD |
| `pr-reviewer` (+ correctness, perf-memory, reuse) | the merge gate |
| `healer` / `tester` | red tests; assertion changes under authority |
| `documenter` / `marketeer` | user docs; business case, when asked |

## Docs
`docs/agents/` (rules, deviations, review checks), `docs/prds/index.md` (generated).
