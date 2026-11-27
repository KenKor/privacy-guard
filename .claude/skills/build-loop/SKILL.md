---
name: build-loop
description: Work the repo's build queue unattended, one item per iteration (open PRs it is asked to finish, then ready-for-agent tickets, then reviewed PRD plan items; in the lane closeout, implemented PRDs to close out), from claim to a merged PR (under the merge setting on-word, a merge-ready one), without asking the user anything. Reads its settings from docs/agents/build-loop.md. Run it under /loop with no interval, for example "/loop /build-loop lane 0 of 1 until 07:00". Only when the user invokes it or a /loop prompt names it; never on your own initiative.
metadata:
  version: "1.28"
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: 'f="${CLAUDE_PROJECT_DIR}/.claude/hooks/guard-bash.py"; [ -f "$f" ] || exit 0; python3 "$f" builder'
---

# Build loop

One iteration of an unattended build loop, started with `/loop` and **no interval**: pace yourself
with `ScheduleWakeup`, sleep while CI runs. Nobody is watching, so:

- **Never ask.** No `AskUserQuestion`, no "shall I". Needs the user: write under **Needs the owner**
  in the state ticket, skip the item, move on. A skip with its reason is a normal outcome.
- **Tree and tracker are your only memory.** Context gets compacted or cleared overnight. Read state
  at the start of every iteration, write it back before ending.
- **A blocked tool call is an answer.** Refused by a permission prompt, the auto-mode classifier or a
  hook: no retry in another form. Record under Needs the owner, skip the item.

## Settings and precedence

First, every iteration: read `docs/agents/build-loop.md` (the first of `docs/agents/`, `Docs/agents/`,
`manual/agents/` that exists, for every such path here). It names state ticket, commands, CI check,
merge policy, lanes, extra NEVER rules. **Missing, or a needed value unset: say so in one line, end
the loop (`ScheduleWakeup` with `stop: true`).** Never guess a test command or merge policy.

The repo's process doc (named in the settings, e.g. root `SKILL.md` or `docs/agents/`) wins where
stricter than this skill, and where it sets the merge command or review range for a kind of PR it
owns (e.g. an upstream release PR). Such a merge command still pins the head: it carries the `<sha>`
the gate was checked on (`--match-head-commit <sha>` or the same check in another form); a command
without one does not apply, and the PR waits under Needs the owner. Once per session also read
`docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, `docs/agents/domain.md`,
`docs/agents/unattended-protocol.md`.

**`tracker: azure`** (Azure Boards and Azure Repos): every `gh` command in this skill means its
counterpart in `docs/agents/issue-tracker.md`. No counterpart there: one Needs the owner line, skip the
step. Step 5 has items of its own for it.

## Arguments

`$ARGUMENTS`, in any order:

- `lane <k> of <n>` (modulo lanes) or `lane <name>` (named lane from the settings). Default
  `lane 0 of 1`: everything.
- `lane closeout`: the close-out lane (source (d), `closeout.md`), under either lane setting. One per repo.
- `until <HH:MM>`: local time to write the summary and stop. Default: the settings' `stop_at`, else
  run until stopped.
- `dry-run`: steps 0 and 1 only, report what would be picked, stop. For trying the settings in
  daylight.
- `finish #<n>` (several allowed): adopt those open PRs and finish them (`finishing.md` in this
  skill's folder) before picking anything new. Only the owner or a shepherd message names them. In
  the wake prompt, keep only the PRs still waiting to be adopted (`finishing.md` step 1, wait); an
  adopted PR is found again as mine. With `only`, the next bullet's rule replaces this one.
- `only`, with `finish`: a finish-only loop. Pick nothing, ignore `stop_at`; keep in the wake prompt
  the named PRs not yet done (merged, closed, READY TO MERGE, handed back, superseded, or refused at
  adoption); stop (Stopping) when none is left.
- `finish` without `lane`, in a session whose loop runs: adopt them now, then go on with the loop. My
  next wake prompt is the loop's previous one plus `finish` with the PRs still waiting. No loop runs
  in this session: as `lane <x> only finish …`, with this session's lane (`<name>-builder-<x>`),
  else a lane whose heartbeat is neither `working` nor `waiting`, so a running lane keeps its own.

Pass the arguments in the `prompt` of `ScheduleWakeup` verbatim, except as `finish` says above.

A message from this repo's `shepherd` session carrying a builder command of
`docs/agents/unattended-protocol.md` ("Messages from the shepherd") counts as the user invoking it.

## Identity: which PRs are mine

All loops push as one GitHub account; author and assignee cannot tell them apart. **My branches
start with `<branch_prefix><lane>/`** (e.g. `loop0/`, `loopB/`); my PRs are the open PRs whose head
branch has that prefix, plus the open PRs whose adopter is my lane (`finishing.md`, "The markers").
Nothing else is mine (see Never).

## Each iteration

### 0. Orient

1. Run `date`. Past `until`: go to **Stopping**.
2. Read the state ticket (newest state on top), comments included. Older names (Needs <name>, Ready for
   <name>, `needs_<name>_ok`, `needs_owner_ok`) mean the same; rename an old heading when you edit the body
   (`docs/agents/unattended-protocol.md`, "The owner's sections"). Under Needs the owner: answered by
   the owner is actionable, unanswered stays skipped. A line "`auto` refused, `on-word` until
   `<YYYY-MM-DDTHH:MM+hhmm>`" whose date and time have not passed, or "`auto` refused, `on-word`
   until the owner answers" without the owner's answer: work under `on-word` (section 5). The time carries its
   UTC offset (`date +%Y-%m-%dT%H:%M%z`); compare it with `date` in that offset. A line without an
   offset (older form) is the time on this machine.
3. `git fetch --prune`; `git worktree list`; `ListAgents` where available (live peers);
   `gh pr list --state open --json number,title,headRefName,isDraft,files`.
4. Before picking anything new: a PR named by `finish` and not yet adopted: adopt it (`finishing.md`).
   An adopted PR of mine: its next step there. A PR of mine waiting on review: section 4 (Review). One waiting on
   CI, or on the owner's merge word (under `on-word`, or after a refused merge: section 5, `auto`):
   section 5 (Merge gate).
5. At `max_open_prs` of my PRs open, refused ones included (adopted ones at READY TO MERGE not): do
   not pick. Handle those, then sleep (Waking).

### 1. Pick

In this order, within my lane only:

- **(a) A ticket**: open, labelled `ready-for-agent`, **not labelled `later`**, no assignee, no open
  blocker (native blocking links; read `--comments` too, a blocker is sometimes only in a comment).
  Earliest open milestone first (the milestone order in `docs/agents/triage-labels.md`: dated ones by
  due date, then undated ones by version number), then the next; no milestone last. `later` is
  parked by the owner's triage: never pick it, also when nothing else is pickable.
- **(b) A PRD plan item**, only if the settings enable source (b): next unticked plan item of a PRD
  in the reviewed folder on `origin/<default_branch>` whose Status: line has no claim, with no OPEN decision of
  its own, **not yet decomposed into tickets** (a decomposed PRD's work enters only through (a)),
  and past any hold the settings name.
- **(c) Extra sources**: each entry of the settings' `extra_sources`, in the order given, under the
  rules written there (e.g. finished OpenSpec changes to archive, an upstream release to merge).
  Never overrides the skip rules below.
- **(d) Close-out**, only in the lane `closeout` and only with `sources.closeout: true` (else say so
  and stop): a PRD in the implemented folder, by `closeout.md` in this skill's folder. That lane
  picks nothing else; no other lane picks (d).

**In-flight check before choosing** (work in progress elsewhere): open PRs by title, branch and
files; `git branch -r --list '*<word>*'`; `rg` over the PRD folders for the item's name; a live peer
on it. Any hit: skip.

**Skip, and record why in the state ticket**, anything that:

- needs a decision, a premise you cannot verify, or a choice the PRD did not make;
- you are less than 98% sure how to read;
- is under Needs the owner without the owner's answer;
- would need an action the settings reserve for the owner's OK.

Record each skip once. Later: read the record, do not reconsider the item until something about it
has changed.

**Route a skip that needs a decision** to the decider, same iteration, exactly as
`docs/agents/unattended-protocol.md` ("Routing a decision") says: state the question and the options
you saw, never pick one, route an item only once. A PRD item is pickable again once the PRD on
`origin/<default_branch>` records the decision; then close its leftover `Decision needed:` issue.
Questions found later (a falsified premise, a review finding, a reserved action): do not route,
write under Needs the owner (the `shepherd` routes the decisions among them once they have waited).

**Premise check (PRD items).** PRD records no `prd-reviewer` pass, or says one is owed: before
claiming, spawn `prd-reviewer` with the PRD path and nothing else. A verified finding that falsifies
a decision's premise or needs a new decision: do not build, list under Needs the owner, pick again.
Otherwise fold the corrections into the claim commit and record the pass on the Status: line (so it
runs once per PRD).

Nothing pickable: say so in one line, write it to the state ticket only if it differs from the last
entry, sleep (Waking).

### 2. Claim

1. Ticket: `gh issue edit <N> --add-assignee @me` **before** any commit.
2. `git worktree add <worktree_root>/<repo>-<slug> -b <branch_prefix><lane>/<slug>-<N> origin/<default_branch>`.
   Work only inside it.
3. PRD item: first commit sets the PRD's Status: line to the settings' `claim_format` and runs the
   index command (`prd_index`) if the repo has one.
4. OpenSpec: build only against a change that already exists under `openspec/changes/`. Next step is
   a new change: write it only where the settings give a standing OK, as its own code-free PR; build
   against it in a later PR. No such OK: unassign, skip, Needs the owner.
5. Push the claim commit and open a **draft** PR at once (peers see the claim). It stays a draft
   until the merge gate holds (section 5): draft = a lane is still on it, ready = passed the gate.
   With `tracker: azure` it is published earlier (section 5, "Publish"), so published does not mean
   it passed the gate: its READY TO MERGE line, or the merge, does.

### 3. Build

- `/tdd` at the seams the item names, at least one where data crosses (`git grep` a helper for a
  non-test caller). Except docs or config: a test fails first, for its reason, on real-shaped data.
- Run `build` and `test_short` in the background, logs under `$TMPDIR` (or `log_dir`), each ending
  `; rc=$?; echo "VERDICT: exit=$rc"`; read the log, then write. No check you act on goes through
  `head` or `tail` (exit code lost).
- A claim holds when measured: an explanation if the number it predicts is observed, a sentence if its
  "every" or "the only" was checked. A script that could not read its input says so, not "none found".
- Stage explicit paths; `git branch --show-current` before, `git status --short` after each commit
  (subagents write too). Code staged without the PRD edit it ticks (`git diff --cached --stat`): that
  edit was dropped.
- Before every push, `gh pr view <n> --json state`: MERGED, carry the commits to a new branch and PR;
  CLOSED, stop, one line under Needs the owner. A push that timed out may have landed: fetch and
  compare before you retry. A scripted edit: assert each replace matched once, read the section back
  from its start. A PR body edit: read it back (`gh api -F body=@x` reads the file; `-f` sends "@x").
- PR body: use the `pr` skill; `Closes #N` for a ticket, the keyword once per ticket when there are
  more (`Closes #1, closes #2`; in `Closes #1, #2` GitHub closes only #1), `PRD: <name>` for a PRD
  item, plus the green record: **"green at `<sha>`"** with the commands and their exit codes.
- **Tripwire.** Same test failing for the same reason after two honest fixes, or a failure you do
  not understand: stop. Hand back in writing (step 6; an adopted PR: `finishing.md` step 6), move the
  item to Needs the owner (or the repo's hospital, if the settings name one). Never weaken or delete
  an assertion to get green.

### 4. Review

A **round** is one `pr-reviewer` pass and, where this step requires it, one squad pass, on one head sha.

1. **Review packet.** Before each round: `git fetch`; `gh pr view <n> --json headRefOid` must be the
   `<sha>` you pushed (if not, stop the round, start it again next iteration). Then write the facts,
   once per distinct diff, to `<log_dir or $TMPDIR>/review-<n>-<sha7>-from-<from7>.md`: PR number,
   head sha, base, claim worktree (step 2.2; reviewers only read it), ticket or PRD path, subsystem,
   whether the squad runs this round (step 4.6), whether the range holds nit fixes only (step 4.7),
   changed files, diff. Facts only: no conclusions of yours, no summary, nothing from the build. Each
   reviewer gets only its packet's path; the reviewer definitions say how to read one. The diff:
   - Round 1, and a reviewer spawned fresh because it is not reachable: `git diff
     origin/<default_branch>...<sha>`; `<from7>` = first 7 characters of `git merge-base
     origin/<default_branch> <sha>`.
   - Round 2 on, a continued reviewer: `git diff <its last sha>..<sha>`; `<from7>` = its last sha.
   - But when `<its last sha>..<sha>` holds a merge of `origin/<default_branch>` (`git rev-list
     --merges <its last sha>..<sha>` is not empty), that two-dot diff also holds everything the merge
     brought in. The diff is instead: `git diff <its last sha>..<sha>` limited to the PR's own files,
     then `git show --remerge-diff <merge>` for each such merge, and "merged the default branch since
     your last pass" in the packet; `<from7>` stays its last sha. The PR's own files are those in
     `git diff --name-only origin/<default_branch>...<sha>` plus those in `git log --first-parent
     --no-merges --name-only --format= <its last sha>..<sha>` (without `--first-parent` the log also
     lists the commits the merge brought in), so a file the PR changed and then put back is still
     shown. In a file that both the PR and the default branch changed, the limited diff also shows
     the default branch's edits: the packet names such files (the PR's own files that are also in
     `git diff --name-only <merge>^1 <merge>`), and the remerge-diff tells the two apart.
   - But when its last sha is not an ancestor of the head (`git merge-base --is-ancestor`; a rebase),
     the diff is instead: first `git range-diff origin/<default_branch> <its last sha> <sha>`, then
     the full three-dot diff, and "rebased since your last pass" in the packet; `<from7>` stays its
     last sha. (One base for both ranges lists only the PR's own commits; the symmetric `<its last
     sha>...<sha>` would also list every commit that landed on the default branch in between.)

   Leave out of the diff and of the range-diff (a pathspec after `--` that matches the file at any
   depth, e.g. `-- . ':(exclude,glob)**/Cargo.lock'`; `':!Cargo.lock'` matches only the root one)
   only the following, and list each such file as wholly or partly left out:
   - `prd_index` output: the hunks in which every line is generated (all of its hunks when it writes
     the whole file). A hunk that also carries a hand edit stays in whole; a pathspec drops only
     whole files, so such a file stays in whole in the range-diff.
   - A lockfile's hunks (e.g. `Cargo.lock`, `package-lock.json`, `packages.lock.json`,
     `poetry.lock`, `uv.lock`): give its `git diff --stat` line and the packages added, removed, or
     changed in version, source or checksum (old and new). A reviewer reads the full diff from the
     worktree when it needs it.
2. **Round 1.** Spawn `pr-reviewer` with the PR number and the packet path, nothing else. Under
   `Regime: code` (step 4.7), in parallel spawn the squad (`correctness-reviewer`, `perf-memory-reviewer`, `reuse-reviewer`), each with the
   packet path; ask each for a severity on every finding. Repo lacks a squad member: the PR does not
   merge (section 5); Needs the owner, to install it.
   **Round 2 on.** Per reviewer that runs in this round (step 4.6):
   - Reachable, context under about 150k tokens (the count its last result reported, e.g.
     `subagent_tokens` in its task notification): continue it. `SendMessage` to its recorded agent id
     (step 4.4) with the new packet path, its own rows of the findings table (fix commit, or why it
     did not hold and how you checked), and the words "nit fixes only" when its packet says so (step
     4.7).
   - Reachable, past that size: spawn a fresh one of the same role with the same packet (the range
     since its predecessor's last pass), the same rows, and "earlier rounds were reviewed by <its
     agent id>; read from the worktree what the range and the rows need". Its pass in the review
     record reads "<new agent id>, takes over from <old agent id>"; from then on continue the new id.
   - Not reachable (another session, or the id is gone): spawn it fresh as in round 1, with the same
     rows and "this is a later round; the range for new findings is <the last reviewed sha>..<sha>".

   In each case it may contest a "did not hold": that is a disagreement (step 4.8).
3. **Severity.** A finding has the severity its reviewer gave it: blocking, should-fix or nit. A squad
   finding with no severity counts as blocking. Never lower a severity a reviewer gave.
4. **Findings.** Verify every finding against the tree before acting on it.
   - Fix **every finding that holds, whatever its severity**, everywhere it applies, in one commit
     and one push per round. Except: a should-fix listed under "Outside the range" (below) is not
     fixed; for the nit-fix pass (step 4.7), one commit per nit, so that one fix can be reverted.
   - **A nit is always fixed in the PR and never goes into a ticket.** Its fix is reviewed on the
     differences only where step 4.6 asks for a round; the nit-fix pass does not count (step 4.7). A nit stays unfixed only when it turns out to need a decision or more than a small
     change, when its fix is reverted (step 4.7), or when the safer reading of a disagreement is to
     change nothing (step 4.8): record it in the table as "left", with the reason; file nothing.
   - **A finding that carries `check:`** names a lint, type, script or test that would have caught it.
     Fix the finding as any other. What happens to the check depends on the finding's severity:
     - **Blocking or should-fix, fixed in this PR:** add the check too when it is small: it needs no
       cleanup of code this PR does not touch, and it passes on the tree once the finding is fixed.
       The check goes in the same commit as the fix, so the two are reviewed and reverted together.
       Its message tells the reader what to do instead, not only what is wrong, so that the next
       author fixes the cause and does not silence the check.
     - **A nit, a check that is not small, or a finding you do not fix here:** the check is one line
       in the follow-up ticket (below), marked `check`. A nit's check is never added in the PR: it
       would turn a nit fix into a change that needs a round of its own (steps 4.6 and 4.7). This is
       the one case where a nit leaves a line in a ticket, and the line is the check, not the nit.

     Record in the findings table which of the two happened. Never answer such a finding with a new
     line of prose in `docs/agents/` or a skill.
   - Record in the PR body, per round: each reviewer's pass (reviewer, its agent id, the sha it
     reviewed, its verdict) and a findings table (each finding, its reviewer, its severity, its
     class, and the fix commit or why it did not hold and how you checked). The class is one of
     `correctness`, `error-handling`, `concurrency`, `performance`, `resources`, `duplication`,
     `naming`, `docs`, `tests`, `security`, `contract`, `scope`, `process`, so that the same kind
     of finding can be counted across PRs. The gate (step 5) is checked against
     this record; a later iteration need not re-run a reviewer to know what it saw.
   - A should-fix that holds but needs a decision, or is too big for this PR: name it in the table
     and go on; it does not hold the merge. **Scope gate first** (`docs/agents/triage-labels.md`; also in 4.7, 4.8):
     one no user can hit in supported use, and none of the always-filed kinds, is recorded as `not filed: <why>`,
     with its `check` line. Collect the rest of one PR, plus each such should-fix a reviewer listed as outside
     the range and each remaining `check` line, into **one** follow-up ticket (`needs-triage`; each finding with
     its `hit:` line; nothing left, no ticket), filed once, linked from the table, its body starting `Rests on:
     #<PR>, <the ticket or PRD decision it carried out>`, `later` unless a finding is strictly necessary for the PR's milestone (then that milestone, naming the finding).
   - A **blocking** finding that needs a decision: Needs the owner, and the PR does not merge.
5. **Close-out commit**, with the last fixes you expect to push: tick the plan item (PRD item), clear
   the claim (never re-claim for the next slice here: that slice claims in its own first commit),
   regenerate the index. PRD's last plan item: run `test_full`, and only if green `git mv` the PRD
   to the implemented folder and rewrite its Status: line to say what shipped. **A ticket that was
   its PRD's last** (its body names a PRD in the reviewed folder that has no claim; no open issue but
   those this PR closes has the exact line `PRD: <name>`: `gh issue list --state open -S '"PRD: <name>" in:body'`,
   then read the hits): the same move, but only when every plan item is ticked or names a ticket that is closed
   or that this PR closes. Else (no checkboxes, or work without a ticket) one line under Needs the owner, once.
6. **When a new round is needed.** **Production code** is every file the repo ships or executes:
   source, build, CI and config files, and agent and skill definitions (`.claude/**`, root `SKILL.md`,
   `CLAUDE.md`, `AGENTS.md`), plus any path the settings' `production_paths` add (absent means none).
   Tests are not production code, but a test change is never exempt. A commit after a reviewer's
   latest pass is **exempt** when it is one of:
   - (a) a fix of exactly the non-blocking findings of that pass that changes no production code and
     no test (wording in docs only);
   - (b) the close-out commit, touching only the PRD and the index;
   - (c) a rebase on, or merge of, `origin/<default_branch>` that leaves the PR's own changes as they
     were: after a rebase `git range-diff` shows the PR's own commits unchanged; after a merge
     `git show --remerge-diff <merge>` is empty or shows only generated files that you re-created by
     running their generator (e.g. `prd_index`). `range-diff` skips merge commits, so it never
     proves a merge exempt;
   - (d) a `git revert` of one or more nit-fix commits and nothing else (step 4.7): it puts those
     lines back as an earlier pass reviewed them.

   Any other commit needs a new round on the new head: a fix of a blocking finding, any
   production-code or test change, any other rebase or merge with a conflict resolution, or any
   unrelated change. A commit is **exempt for the squad** when it is exempt, when it changes no
   production code, or when it is a nit fix reviewed in the nit-fix pass (step 4.7): that round is
   `pr-reviewer` alone, and the squad's earlier pass stands. Otherwise the squad runs in it too.
7. **Rounds.** This step binds every PR an agent opens, whichever skill made it.
   - **Regime.** A PR that changes no production code and no test (step 4.6), such as a PRD or a
     sweep record: `pr-reviewer` alone, at most **2** counted rounds. Any other PR: `pr-reviewer` and
     the squad, at most **3**. Write `Regime: prose` or `Regime: code` in the review record. A later
     commit with production code or a test makes it `code`: the squad then reviews the whole PR.
   - A round caused only by a rebase, or by a merge of the default branch with a conflict
     resolution, does not count, up to 2 such rounds per PR; a third goes to Needs the owner.
   - A decision of the owner that changes the PR's scope while it is in review (it adds to or removes
     from what the PR changes; an answer to a finding or to a disagreement, step 4.8, is not one)
     restarts this count, and only this count: rounds keep their procedure (step 4.2, round 2 on), the
     allowance of 2 rebase or merge rounds stays per PR, and the record names the decision. The owner
     may also order more rounds on a named PR: record the order (who, when, where, how many).
   - In the last counted round, file any should-fix still open into the PR's follow-up ticket instead
     of fixing it, behind the scope gate (step 4.4); for a PRD, into its open items for the walk.
   - **Nits** ride with the next counted round's fixes. Nits still open when no counted round follows
     get one **nit-fix pass** (once per PR, once more after a scope restart): one commit per nit,
     reviewed by `pr-reviewer` alone with "nit fixes only" in its packet. It does not count, unless
     its range held more than nit fixes and the diff confirms it. It is never followed by another:
     - what it draws on a nit fix (a blocking or should-fix finding, or a reviewer calling the fix
       wrong): revert that fix (step 4.6 (d)); record the nit as "left", and the revert as the fix;
     - a new nit raised in it: record it as "left" (reason: raised in the nit-fix pass);
     - any other finding it draws: handle as in any round.
   - Anything that would need a round past the cap (a blocking finding still open, or a fix of a
     blocking or should-fix finding after the last round): hand back (step 6) and one line under
     Needs the owner.
   - **Record.** Each pass gets a heading in the PR body: `### Round <n>, at <sha7>` (after a scope
     restart `### Round <n> after <decision>, at <sha7>`), `### Rebase round <k>, at <sha7>`,
     `### Nit-fix pass, at <sha7>`; an owner order is a line `Owner order: up to <m> rounds (<who>,
     <date>, <where>)`. Step 5 counts these with `check-review-rounds.py`, beside this skill.
8. Two reviewers disagree, or a reviewer contests your "did not hold":
   - on a blocking finding: do not adjudicate. Record both, Needs the owner;
   - on a should-fix or nit: take the **safer reading** (the one that keeps the stricter behaviour
     or changes less) and record both. A should-fix also goes to the follow-up ticket (gated, 4.4); a nit never
     does: one you leave unchanged is recorded as "left".

### 5. Merge gate

Check all of these just now, on the current head sha, not from memory:

- every check in `required_check` (one name, or a list of names) is COMPLETED with conclusion SUCCESS
  on the head (with `required_check: none`, no CI, this item and the draft-run rule below do not apply);
- `mergeable` is MERGEABLE;
- `pr-reviewer` has reviewed this PR, its latest pass was on the head or only exempt commits (step
  4.6) came after it, and that pass was APPROVE or APPROVE-WITH-NITS, or REQUEST-CHANGES with no
  blocking finding, or with blocking findings only on nit fixes that were reverted since (step 4.7);
- under `Regime: code`, the full squad (`correctness-reviewer`, `perf-memory-reviewer`,
  `reuse-reviewer`) has reviewed this PR, each on the head or with only commits exempt for the squad
  (step 4.6) after it; **no squad, no merge**. `Regime: prose` holds only if the PR changes no
  production code and no test;
- `python3 .claude/skills/build-loop/check-review-rounds.py --pr <n>` passes: the record stays within
  the caps of step 4.7 (`tracker: azure`: save the PR description and pass `--body-file <path>`);
- every finding that holds is fixed, or is a should-fix in the follow-up ticket or recorded as `not
  filed`, or is a nit recorded as "left" (steps 4.4, 4.7, 4.8), and no blocking finding is open under Needs the owner;
- the head carries no claim of this PR (the close-out commit is in);
- step 1's in-flight check, run again, finds no other PR or peer on the item and no open PR based on
  this branch (`gh pr list --base`): else one line under Needs the owner, once; mine waits;
- any extra gate in the settings holds on this tree;
- `tracker: azure` only: a reviewer other than the PR's creator approved after the last push, as
  `docs/agents/issue-tracker.md`, "Approval after the last push", checks it;
- `tracker: azure` only: no required build result has expired. Re-queue expired ones ("Re-run a
  check" there) only once every other item holds, then wait as for any running check. This is not an
  infrastructure re-run and has no limit of its own (the owner's decision of 2026-11-18). A red re-run
  is red CI.

**Publish (`tracker: azure` only).** Azure runs build policies and allows votes only on a published
PR (**to verify** on the first agent PR). Once every item but the required builds, the approval and
the expiry holds, publish the PR ("Publish for review" in `docs/agents/issue-tracker.md`) and record
it in the body. A lane still owns it; draft there means only "the squad has not passed it yet". The
draft-run rule below does not apply, and "mark the PR ready" is then already done.

**Ready.** Every item holds: mark it ready (`gh pr ready <n>`), only then merge or write READY TO MERGE.

- The required check must run on draft PRs. A draft head with no check run of it after one `wake_ci`
  wait (a queued run counts as a run), or only a SKIPPED one: one Needs the owner line naming the
  workflow and its draft condition; the PR waits.
- Gate fails after the PR went ready (the base moved, a merge or rebase needs a new round): first set
  it back to draft (`gh pr ready <n> --undo`; with `tracker: azure` it stays published), and
  withdraw its READY TO MERGE line from the body and from Ready for the owner.
- A PR that leaves the loop without passing the gate stays a draft (with `tracker: azure` it may be
  published), named in its Needs the owner line or its hand-back (section 6).

Then, by the settings' `merge` value:

- **`auto`** (the default; the repo's merging policy is the authorization): merge with the
  settings' `merge_command` (or the one the settings name for that kind of PR), `<sha>` = the head
  sha you checked the gate on (a push in between then fails the merge). **Do not ask the owner, and
  do not mark the PR "ready for the owner"**: this loop merges a PR of mine that passes the gate.
  Then check `gh pr view <n> --json state,mergeCommit` before any retry.
  - Merge fails because the head or the base moved (the `<sha>` no longer matches, "Base branch was
    modified", another lane merged first, or `mergeStateStatus` BEHIND where the base must be up to
    date): not a refusal. If behind, merge `origin/<default_branch>` into the branch (or `gh pr
    update-branch <n>`, which makes the merge on GitHub: then `git fetch` and `git merge --ff-only
    origin/<branch>` in the worktree before any other commit; step 4.6 (c)), check the gate again next
    iteration. After 3 such failures in a row on one PR with no other commit of mine in between (these
    update merges do not count as other commits): one line under Needs the owner, leave it.
  - Merge command itself refused (a permission prompt, the classifier, branch protection): no retry
    in another form. Write once under Needs the owner, as a refused tool call, not a question:
    "`auto` refused, `on-word` until `<YYYY-MM-DDTHH:MM+hhmm>`" (the date and time the loop stops,
    with its offset from `date +%Y-%m-%dT%H:%M%z`; without a stop time, "until the owner answers");
    step 0.2 reads that line. Until then work as under `on-word`: mark this PR and every later one
    that passes the gate "READY TO MERGE at `<sha>`", merge nothing, count them all toward
    `max_open_prs` (step 0.5). A loop started after that time tries `auto` again.
- **`on-word`** (only where the owner chose it for a repo, or after a refused merge): do not merge.
  Mark the PR "READY TO MERGE at `<sha>`" in its body and under **Ready for the owner** in the state
  ticket. Merge it in a later iteration only if the owner has written "merge" on the PR or in the
  state ticket, and the gate still holds on the head the owner answered on.

CI and collisions:

- CI still running: sleep `wake_ci`.
- CI red: read the job log first. `main` itself broken: report under Needs the owner, do not touch
  `main`.
- A check that failed for infrastructure only (no runner, a quota, a network error; the build and
  test steps themselves passed or never ran), or still queued for 4 `wake_ci` waits (counted from
  the run's `createdAt`): re-run it once per head sha (`gh run rerun <id> --failed`, or cancel and
  re-run a queued one). No help: one line under Needs the owner, wait for that PR at `wake_idle`.
- Keep the counts above (merge failures in a row, the re-run per head sha) in the PR body next to the
  round record, as "merge retries: 2 at `<sha7>`" and "infra re-run: `<sha7>`", so a compacted context
  does not reset them.
- A local run never stands in for the required check.
- Collision with another PR: merge `origin/<default_branch>` into the branch in my worktree and
  resolve by understanding both sides (a generated file: run its generator again). A pushed branch is
  never rebased, because that needs a force-push (see Never); use `merge_helper` where the settings
  name one. A merge or a resolution needs a new round unless step 4.6 (c) exempts it. The merge helper
  never merges: the merge is this step's, with the gate checked again.
- A PRD that reached implemented: record it in the state ticket as owing docs and the whole-feature
  review (the close-out lane's work, `closeout.md`).

### 6. Hand back in writing

Before ending each iteration, write what is still owed where the next reader looks: the PR body, the
PRD's Status: line (only while its PR is open), the state ticket. Write an obligation
("`pr-reviewer` NOT RUN on `<sha>`, owed before merge"), never a plan ("I'll review next").

Owner needed: one line under Needs the owner; where `PushNotification` is available and the settings
allow night notifications, also send that line. Then go on to the next item.

**Heartbeat.** Keep this lane's one heartbeat comment on the state ticket, in the format and with the
find-then-edit command of `docs/agents/unattended-protocol.md`: `state: working` with the `step` at the
start of steps 1 to 5; here, at the end of the iteration, `state: waiting` with the `next wake` you
are about to schedule.

End the iteration with one line: **what moved, what is waiting, what needs the owner.**

## Waking

Call `ScheduleWakeup` with the same `/build-loop ...` prompt:

- CI running on one of my PRs: `wake_ci` (default 900 s), unless it waits on the owner (section 5).
- Waiting only on the owner (Needs the owner, or the merge word under `on-word`), or nothing pickable:
  `wake_idle` (default 1800 s).
- More work pickable and fewer than `max_open_prs` open: 60 s.

Do not sleep to poll work you started in the background in this session; you are woken when it ends.

## Stopping

At `until`, or when the user stops the loop:

1. Leave no half-made commit: finish or abandon it, and hand back in writing (step 6).
2. Post a **night summary** comment on the state ticket: merged, ready for the owner (under
   `on-word`, with sha), waiting on CI, skipped with reasons, Needs the owner. Only what the owner must
   read. A finish-only loop posts none: its heartbeat says it.
3. Set this lane's heartbeat to `state: stopped`, with the time and `item: night summary posted` (a
   finish-only loop: `item: finished #<a> #<b>`).
4. `ScheduleWakeup` with `stop: true`.

## Never

- Ask the user a question, or make a design decision yourself.
- Force-push, bypass branch protection, use `--admin`, or `git add -A`. Where the repo carries
  `.claude/hooks/guard-bash.py`, the hook in this skill's frontmatter refuses those commands; a refusal
  is final, not something to work around.
- Merge a PR that fails the merge gate (step 5), or, under `on-word`, one without the owner's word.
- Under `auto`, ask the owner whether to merge a PR that passes the gate.
- Touch a worktree, branch, server or process you did not create, or commit or push to a branch
  without my prefix, except the branch of a PR I adopted (`finishing.md`).
- Resolve a conflict by taking one side blind, or weaken a test to make it pass.
- Delete branches or worktrees that are not mine; force-deleting a branch is the owner's call.
- Put customer or confidential data in an issue, PR, commit or prompt.
- Anything the settings' `never` list adds.
