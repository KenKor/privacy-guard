# Closing out a PRD

Part of the `build-loop` skill (copy it next to its `SKILL.md`). Read it when my lane is `closeout`.

The build lanes stop when a PRD reaches the implemented folder. The close-out lane takes it from
there to completed: the whole-feature review, the user-facing docs, the spec archive where the repo
has OpenSpec, and the archive by `prd-archiver`. One close-out PR per PRD.

The unit differs from a build item: a build PR is judged as shippable, a close-out judges a whole
feature as coherent, over every PR the PRD produced. Everything else is the build loop's. These
apply unchanged, with the heartbeat `role=builder lane=closeout`:
`SKILL.md` section 0 (Orient), `SKILL.md` section 5 (Merge gate), `SKILL.md` section 6 (Hand back),
Waking, Stopping and Never. The steps below take the place of its Pick, Claim, Build and Review. The
rules of `SKILL.md` section 3 (Build) hold for every fix I make here: the short suite, the read-back,
explicit paths, the tripwire. Where the repo's settings or canonical instruction file say more about
close-out (a ledger, an index, its own review rules), they win.

**One close-out lane per repo.** Its PRs touch the most contended files (the PRD index, a ledger).
I am a duplicate when both hold:

- the `lane=closeout` heartbeat is running: `working` and younger than 12 hours, or `waiting` with
  its wake still ahead;
- it is not mine: its `host:` is another machine, or `ListAgents` shows another live session on the
  lane.

Then end with `ScheduleWakeup` `stop: true` and one line to the user; edit no heartbeat, post no
summary. Otherwise go on: the heartbeat is my own from before a restart, or a dead lane's (a
`working` one older than 12 hours from another machine: record that once in the state ticket).

**An open close-out PR of mine** (Orient): one that only moves a PRD back to reviewed resumes at
step 5. Any other resumes at the first step whose record is missing: no review record on the PRD's
Status: line, step 3; PRD not yet in the completed folder, step 4; else step 5.

## 1. Pick

First, once per run: `.claude/agents/documenter.md` and `prd-archiver.md` must exist. One is missing:
one line under Needs the owner, then Stopping. Nothing is claimed.

The PRD that entered the implemented folder (`prd_implemented_folder`) earliest, on
`origin/<default_branch>`:
`git log --diff-filter=A --format=%cI -1 origin/<default_branch> -- <path>`. Skip one that has:

- an open PR on it, or a live peer on it (the in-flight check of `SKILL.md` section 1);
- a claim on its Status: line. With no open PR that claim is stale (a dead close-out, or a build
  claim that was never cleared): record it once in the state ticket and skip;
- a recorded skip that nothing has changed since, or a line under Needs the owner without the
  owner's answer.

None left: say so in one line and sleep (`wake_idle`). Before that, once per run, the backstop for
the ticket path (step 4.5 moves a PRD with its last ticket, and two lanes closing the last two
tickets at once each see the other's): a PRD in the reviewed folder with no claim, every plan item
ticked or naming a closed ticket, no open item on its Status: line (step 3 writes one when it
moves a PRD back), and no open issue whose body has the exact line `PRD: <name>` gets one line under
Needs the owner, "ready for implemented". Never move it myself.

## 2. Claim

Worktree and branch from fresh `origin/<default_branch>`, the branch named
`<branch_prefix>closeout/<slug>`. First commit: the PRD's Status: line gets the settings'
`claim_format` with `close-out` as the slice; run the index command (`prd_index`) if the repo has
one. Push and open a **draft** PR at once, its body starting with `PRD: <name>` and `Close-out`.
Record the pick and the PR number in the state ticket.

## 3. Review the whole feature

1. **Find the PRD's own PRs**: the merged PRs whose body carries `PRD: <name>`, and those that closed
   a ticket naming the PRD. Where that finds none, the commits `git log origin/<default_branch>
   --grep "<PRD name>"` finds. Never a sha range or a date range: a range picks up every unrelated PR
   that landed in the window.
2. **Spawn `pr-reviewer`** with that list of PRs or commits and the PRD path, and nothing else. Spawn
   the squad reviewers (`correctness-reviewer`, `perf-memory-reviewer`, `reuse-reviewer`) only on the
   parts that touch a hot path, shared or concurrent state, or add real complexity, each with the
   list and the subsystem. Run them in parallel.
3. **Verify each finding against the tree** before acting on it. Then:
   - Holds, and is a docs, test or wording fix: fix it in this PR, everywhere it applies.
   - Holds, but fails the scope gate (`docs/agents/triage-labels.md`: no user can hit it in supported
     use, and none of the always-filed kinds): not a gap. Record it in the PR body as
     `not filed: <why>` and go on.
   - Holds, and needs more implementation or a new decision: **stop this PRD.** `git mv` it back to
     the reviewed folder (`prd_reviewed_folder`), with the open item on its Status: line in place of
     the claim; regenerate the index. That move is all this PR then carries: take it through step 5
     below and the merge gate. More implementation: file one ticket for it (`needs-triage`, its
     body starting `Rests on: #<PR>, <the PRD>`, then the line `PRD: <name>`); once triaged, that
     ticket brings the PRD back to the build lanes. A decision: one line under Needs the owner, saying that
     `prd-reviewer` must run on the PRD's premises before the walk. Never decide it myself.
   - Does not hold: record it in the PR body with what falsified it.
4. **Record a clean review** on the PRD's Status: line, in a commit: which reviewers ran, over which
   PRs, against which sha, and each verdict. `prd-archiver` refuses to archive without it.

## 4. Docs, spec, archive

In this PR, only after a clean step 3:

1. **Docs.** The PRD changed user-facing behaviour: spawn `documenter` with the PRD path. Read what it
   wrote against the shipped code before committing; a page that contradicts the code is worse than
   none. Nothing user-facing changed: say so on the Status: line and in the PR body, so the archiver's
   docs check sees the reason.
2. **Spec**, where the repo has `openspec/` and the PRD has a change there: read the change's delta
   against the shipped code, then sync and archive it with the repo's OpenSpec archive skill. Check
   that sibling changes on the same spec still validate after the archive.
3. **Decisions worth keeping.** List in the PR body the PRD's decisions that look hard to reverse,
   surprising without context, and the result of a real trade-off, as candidates for an ADR. Write
   an ADR only where the settings give a standing OK; otherwise one line under Needs the owner with
   the candidates. The line does not hold up the archive.
4. **Archive.** Spawn `prd-archiver` with the PRD path and the instruction to stage, not commit. A
   failed check: fix it and run the archiver again; never archive past it. Then commit the staged
   move myself and check it: the PRD is in the completed folder (the one `prd-archiver` names); its Status: line says what shipped
   and carries step 3's record (reviewers, PRs, sha, verdicts); no claim is left on it; the index is
   regenerated; `git diff --cached --stat` showed insertions on the PRD.

## 5. Review the close-out PR

As any PR of the build loop: the review packet of step 4.1, the findings of step 4.4, the rounds of
step 4.7, with `check-review-rounds.py`. A PR that only moves a PRD back to reviewed gets one
`pr-reviewer` pass.

Then `SKILL.md` section 5 (Merge gate): mark the draft ready and merge under the settings' `merge`
and `merge_command`. After the merge, replace the PRD's "owing docs and the whole-feature review"
entry in the state ticket with a one-line record: completed with the PR, or back to reviewed with
the open item.

## Never

On top of `SKILL.md`'s Never:

- Archive a PRD whose whole-feature review found a real gap that is not fixed.
- Drop the review's record from the Status: line when rewriting it.
- Review over a sha range or a date range.
- Pick a ticket, a PRD plan item or an extra source in this lane.
