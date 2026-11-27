# Build loop settings

Settings for the `build-loop` skill (`.claude/skills/build-loop/SKILL.md`). Start:

```text
/loop /build-loop lane 0 of 1 until 07:00
```

First try the settings in daylight: `/build-loop dry-run`.

## Settings

```yaml
tracker: github
state_issue: "#55"
process_doc: "CLAUDE.md and docs/agents/ ; they win where stricter"
default_branch: roles        # the branch that plays the default branch (see Deviations)
branch_prefix: loop          # my branches are loop<lane>/<slug>-<N>
worktree_root: ".."          # worktrees go to ../<repo>-<slug>
max_open_prs: 1              # per lane
owner_accounts: []

sources:
  tickets: true              # (a) ready-for-agent issues
  prd_items: false           # (b) no reviewed PRD waits here
  closeout: false            # (d) no close-out lane here
prd_reviewed_folder: "docs/prds/reviewed/"
prd_implemented_folder: "docs/prds/implemented/"
claim_format: "IMPLEMENTING: <slice> (<date>) #<PR>"
prd_index: none
prd_hold: none
openspec_delta_ok: none
extra_sources: []

build: "npm ci && npm run lint"
test_short: "npm test"
test_full: "npm test"
log_dir: "$TMPDIR"
required_check: "test"       # .github/workflows/test.yml, runs on every pull request, drafts too
extra_gates: []

merge: auto                  # merge on green, after the review squad
merge_command: "gh pr merge <n> --squash --match-head-commit <sha>"
merge_helper: none
production_paths: []
hospital: none               # a failing test nobody can resolve becomes an issue labelled hospital

lanes: modulo

wake_ci: 300
wake_idle: 1800
stop_at: ""
notify_at_night: false

needs_human_ok: []
never:
  - "run a send with --confirm, or contact a broker: every outward request stays a dry run"
  - "put personal data in a fixture, a test, an issue or a log"
```

## Deviations

- **`roles` plays the default branch.** This repo is the practice example of a course. Each add-on
  keeps its work on its own branch, so the core story on `main` stays as recorded. Branch from
  `origin/roles`, open pull requests against `roles`, and read "the default branch" in the skills
  as `roles`.
- **The owner is played by the course author**, who also plays the timer: each wake of a role is
  started by hand.
- **The host field of a heartbeat reads `sandbox`.** The machine's name does not belong on a public
  repository.
