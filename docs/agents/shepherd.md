# Shepherd settings

Settings for the `shepherd` skill (`.claude/skills/shepherd/SKILL.md`). The skill also reads
`docs/agents/build-loop.md` (state issue, lanes, branch prefix) and `docs/agents/unattended-protocol.md`
(heartbeats, decision routing and claims between sessions; template `templates/unattended-protocol.md`).

## Settings

```yaml
run_window: "22:00-07:00"    # local time the builder lanes are expected to run
timezone: "Europe/Amsterdam" # the zone of run_window; heartbeats are in UTC
expected_lanes: []           # lanes that must start every night, e.g. ["0"]; empty: no "not started" check
grace_minutes: 30            # past a heartbeat's next wake before a lane counts as silent
working_stale_minutes: 180   # a builder step (build, review squad) running longer than this is silent
probe_hosts: []              # no probe timer runs for this sandbox
probe_stale_minutes: 45
sweep_hours: 3               # a sweep heartbeat stuck on "sweeping" longer than this
claim_stale_hours: 12
pr_red_hours: 6
review_owed_hours: 12
sweep_wait_days: 2           # needs-decision with no sweep since
sweep_pr_days: 2
needs_human_days: 2
ready_unclaimed_days: 3
worktree_stale_days: 3
closeout_after_days: 7       # S18: a PRD in the implemented folder this long with no close-out lane running

route_decisions: true        # S5: route every waiting decision to the decider (unattended-protocol.md)
max_routes_per_run: 5        # oldest first; the rest wait for the next run
decider_trigger: none        # no cloud routine for this sandbox
decider_trigger_hours: 12    # at most one start per this many hours
send_to_sessions: true       # locally: send work to the live <name>-decider / <name>-builder sessions
decider_session: "{prefix}-decider" # {prefix}: the shepherd's own session name without "-shepherd"
builder_session: "{prefix}-builder" # a builder's name, or "<name>-<lane>" per lane
send_hours: 12               # the same command to the same session at most once per this many hours
approver: none               # a GitHub login whose "shepherd yes" comment approves; only one no agent posts as
delete_merged_branches: false # true: delete merged builder branches without asking; false: propose it
notify_login: none           # e.g. a GitHub login to @-mention on new red items and new proposals
open_for_review: false       # locally, with a screen: open the .md file a Needs you / Say yes line asks you
                             # to read in your system's Markdown app (section 7); false: never
max_opens_per_run: 3         # the rest open on a later run
finish_after_days: 2         # S16: a PR outside the builder branches, idle this long, goes to a builder
draft_idle_days: 7           # S16: the same for a draft, but only on your yes
max_finish_per_run: 3        # S16: PRs sent to a builder per pass, oldest first
intake_ratio: 1.5            # S20: issues created over issues closed in 7 days; above it for a week: an owner line
intake_min: 10               # S20: fewer issues created than this in 7 days never counts
wake: 3600
```

## How to use it

**Start it.** Start the repo's three sessions side by side on your machine, with one name in front so
the shepherd finds the others: `<name>-builder` (or `<name>-builder-<lane>`), `<name>-decider`,
`<name>-shepherd` (for example `pg-…`). All three in the same permission mode (auto mode): a session
in another mode holds the shepherd's messages until you approve them there. In the shepherd session:

1. `/shepherd dry-run`: one pass that writes, sends and starts nothing. Read what it would do.
2. `/loop /shepherd`: a pass every hour (`wake`), every 15 minutes while something new is red. Several
   repos from one session: `/loop /shepherd owner/repo1 owner/repo2`.

**What it does without you.** Routes every waiting decision to the decider and sends the decider
session `/decision-sweep #...` for them (no decider session: starts the decider's cloud routine).
Prepares your walks: sends `/decision-walk #...` to the decider session, which sets up the walk sheets
and waits for you there. Sends every PR that nobody finishes (design, docs, intake, sweep and session
PRs, idle for `finish_after_days`, conflicting or red) to a builder session as `/build-loop finish #...`:
the builder brings it up to date, builds, reviews and merges it under its merge gate, or marks it
READY TO MERGE where the merge is yours. An idle draft is an owner line with that command to paste. Every send and routing is under **Done** in its report.

**What it asks you: say yes.** Chores it does only on your word come as numbered proposals: release an
orphaned claim, delete merged builder branches, remove clean worktrees, merge a green sweep PR (it lists
what the sweep decided), start or restart a lane in its idle builder session while work is ready, close a PR a builder found
superseded (with its evidence).
Answer in the shepherd session with `yes`, `yes 11 12` or `no 13` (only what you type there counts). A
shepherd that runs from a timer has no session of its own: type `/shepherd yes 11 12` in any session of
yours in the checkout (a lane start then comes back as a command to paste in the builder session). With `approver` set, you can also comment `shepherd yes` (or `shepherd yes 11`) on
the state issue; the next pass carries it out. A declined proposal is not made again.

**What only you can do.** Under **Needs you**, each line says what is stuck, what it blocks, and the one
thing to do: a command to paste (and where), a link to open, or the session to switch to. Nothing else
needs reading. The report is one comment on the state issue, first line `<!-- shepherd-report -->`,
edited in place; locally the shepherd session shows the same text.

**Limits.** Never builds, decides or reviews. Merges, closes, releases or deletes only on your yes
(merged builder branches also with `delete_merged_branches: true`). Routes each decision once, at most
`max_routes_per_run` per pass. Wrong routing: undo it with the command under **Done**; it is not routed
again.

**Let it start the decider.** Needed only where no `<name>-decider` session runs (the cloud, or a night
without the decider session). Without it, the report gives you `/decision-sweep #...` to paste.

1. Required: the Claude GitHub app installed on this repo; `decision-sweep`, `unattended-protocol.md`
   and the `needs-decision` label on the default branch.
2. In a Claude Code session in the checkout, type `/schedule` and ask for "a routine for <owner/repo>
   that runs `/decision-sweep`, every day at 19:00 Europe/Amsterdam, on the strongest model" (a slower
   schedule works too: the shepherd starts it when needed). Check the run time it shows.
3. Ask "list my routines with their trigger ids" and copy the new one's `trig_...` id.
4. Test it: "run routine `trig_...` now". A `<!-- heartbeat role=decider -->` comment appears on the
   state issue (`sweeping`, then `done` with the sweep PR). If not, "show the run log of its last run":
   usually a branch push the cloud environment refuses, or a tool it is not allowed.
5. Put the id in this file, `decider_trigger: trig_...`, and merge that change. The shepherd reads its
   settings from the default branch.

The shepherd starts the routine only where it has the `RemoteTrigger` tool (a local session does), at
most once per `decider_trigger_hours`, and only for decisions routed after the last sweep.

## Where it runs

- **Local, from a timer** (recommended): a `/loop` ends with its session, and a session waiting on a
  prompt stops its loop too. A systemd user timer runs one pass every hour, whatever happens to your
  sessions. A pass started this way sees the sibling sessions (checked 2026-11-18); that its messages
  reach them is to verify on the first run:

  ```ini
  # ~/.config/systemd/user/shepherd-<name>.service
  [Unit]
  Description=Shepherd for <owner/repo>: one pass
  [Service]
  Type=oneshot
  WorkingDirectory=%h/path/to/checkout
  ExecStart=/bin/bash -lc 'claude -p "/shepherd" -n <name>-shepherd --permission-mode auto'
  TimeoutStartSec=45min

  # ~/.config/systemd/user/shepherd-<name>.timer
  [Timer]
  OnBootSec=10min
  OnUnitActiveSec=1h
  [Install]
  WantedBy=timers.target
  ```

  `systemctl --user enable --now shepherd-<name>.timer` (and `loginctl enable-linger $USER`, as for the
  probe). `bash -lc` reads your profile, so the run gets your `PATH` and `CLAUDE_CODE_TMPDIR`. A run
  from a timer needs a sign-in that lasts: you set it up yourself with `claude setup-token`, and the
  token never goes into a chat, a repo or this file. Stop any `/loop /shepherd` session for the same
  repo: one shepherd per repo.
- **Local, in a session** (builder and decider run as sessions here): `/loop /shepherd` in
  `<name>-shepherd`. It stops with the session. Here it can take your `yes` in its own session.
- **Cloud**: a Claude Code on the web session, a scheduled routine (`/schedule`) or a repo-bound
  project, every hour, on Sonnet: `/shepherd`. It reads only GitHub, so a reboot of your machine does
  not stop it; it reports the reboot. It gives commands to paste instead of sending them, and takes
  `shepherd yes` comments (with `approver` set).

Run one shepherd per repo, not both: they would share one report comment.

## The local probe

The cloud cannot see the owner's worktrees or processes; a small script without a model reports them
to each repo's state issue. Copy `templates/skills/shepherd/shepherd-probe.sh` to `~/bin/` and run it
every 15 minutes with a systemd user timer:

```ini
# ~/.config/systemd/user/shepherd-probe.service
[Unit]
Description=Shepherd probe: report worktrees and loop sessions to the state issues
[Service]
Type=oneshot
ExecStart=%h/bin/shepherd-probe.sh --clean %h/path/to/repo1 %h/path/to/repo2

# ~/.config/systemd/user/shepherd-probe.timer
[Timer]
OnBootSec=2min
OnUnitActiveSec=15min
[Install]
WantedBy=timers.target
```

`systemctl --user enable --now shepherd-probe.timer`, and `loginctl enable-linger $USER` so it runs
without a login. Try it first with `shepherd-probe.sh --dry-run <repo>` (writes nothing, does not fetch).

`--clean` lets the probe remove a worktree (`git worktree remove`, never `--force`) when all hold:

- its PR is **merged** (never only closed: a closed PR may be a released claim a silent lane still uses);
- no changes;
- no ignored files outside build output (`PROBE_BUILD_DIRS`, default
  `target node_modules bin obj .venv __pycache__ dist build`);
- no Claude session *started* in it. A session started in the main checkout that works in a worktree
  through its shell is not seen; merged-only is what keeps that safe.

Leave `--clean` off until a few dry runs agree.

## Deviations

- `roles` plays the default branch (`docs/agents/build-loop.md`, Deviations): read the settings and
  the checks of "the default branch" from `roles`.
- No probe timer and no cloud routine run for this sandbox, and `open_for_review` is off: the passes
  are recorded headless, without a screen.
- The thresholds are the skill's defaults. Nothing was lowered to make an item look stuck.
