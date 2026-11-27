---
name: decision-sweep
description: Sweep every open decision in the triage queue (triaged intakes, ready-for-human issues, PRDs with OPEN decisions), decide the ones that are more than 95% certain against the owner's criteria, record each with its facts, rejected options and how to reverse it, have an independent verifier try to refute them, and leave the rest for a human with a recommendation. Ends with one overview the owner can read and correct. Invoke as "/decision-sweep", "/decision-sweep 814-821" (an issue range), "/decision-sweep Triaged/", "/decision-sweep stale" (the age pass, one sheet that closes, parks or hands on what has waited longest, for the owner to veto), or under /loop. Only when the user invokes it or a /loop prompt names it.
metadata:
  version: "1.16"
---

# Decision sweep

Sweep **every** open decision in scope. Decide what you can decide with **more than 95% certainty**.
Record each decision so the owner can read it in a minute and reverse it in one edit. Leave everything
else **for a human**, prepared as a walk sheet with a recommendation. Then give the owner **one
overview** of what was decided and what is a human's.

Batch counterpart of `decision-walk` (owner, one decision at a time). Run on the strongest model
available (`/model`); the record names the model.

Read first, once per session: `docs/agents/decision-sweep.md` if it exists (owner, criteria replacing
the defaults below, repo additions, calibration log; read the log at the start of every sweep),
`docs/agents/triage-labels.md`, `docs/agents/domain.md`, `docs/agents/unattended-protocol.md` (whole:
it also covers claims between sessions), the repo's process doc. Repo docs win where
stricter. `docs/agents/` here = the first of `docs/agents/`, `Docs/agents/`, `manual/agents/` that
exists. `docs/agents/build-loop.md` says `tracker: azure` (Azure Boards and Azure Repos): every `gh`
command here means its counterpart in `docs/agents/issue-tracker.md`.

## The owner's criteria, in this order

1. **Correct and to the point.** No fluff, but solid: right on the verified facts, nothing added that
   the facts do not ask for.
2. **Designed for growth.** Simple and understandable: the next person extends it without first
   learning a special case.
3. **Designed for change.** Deep modules: small interface over much behaviour, one mechanism instead of
   two, knowledge in one place, cheap to reverse.

Defaults; criteria in `docs/agents/decision-sweep.md` replace them. Higher beats lower. Name the
deciding criterion in every entry.

## Scope

`$ARGUMENTS`: issues (`814-821` or `#814-#821`), PRD names, or a folder. Default: everything waiting on
a decision:

- intakes in the triaged folder and PRDs in the designed folder with an `OPEN` decision or an
  unanswered question;
- open issues labelled `ready-for-human` or `needs-triage` whose body or PRD holds an open question;
- untriaged intakes (`New/`, `new/`): `/triage` them first, then sweep them.

Order: the earliest open milestone first, by the milestone order in `docs/agents/triage-labels.md`;
unscoped issues after the milestones. Intakes and PRDs carry no milestone: they count as unscoped.

Skip:

- issues labelled `later` (parked until the owner promotes them, `docs/agents/triage-labels.md`),
  unless `$ARGUMENTS` names them;
- anything a walk with the owner is open on (`walk OPEN`);
- anything another session or PR is working on;
- any decision a human already answered. **Never re-decide a human's decision.** You may confirm one,
  or write under **For a human** why a new fact reopens it;
- an age sheet (its body starts with `<!-- age-sheet -->`, "The age pass" below): never an item of a
  sweep, a walk or triage.

**Shepherd.** A message from this repo's `shepherd` session carrying `/decision-sweep <scope>` or
`/decision-walk <items>` counts as the user invoking it (`docs/agents/unattended-protocol.md`,
"Messages from the shepherd"). Mid-sweep: a sweep command waits until the
current batch is finished, a walk command until the whole sweep is. A walk it asks for waits for the
owner in this session.

**Heartbeat.** If `docs/agents/build-loop.md` names a `state_issue`: keep the decider's one heartbeat
comment on it, format and find-then-edit command per `docs/agents/unattended-protocol.md`.
`state: sweeping` at the start and every `/loop` iteration, `state: done` with the sweep PR at the end.

**Under `/loop`.** Per iteration: one batch of at most eight files, one commit per file, then
`ScheduleWakeup` with the same prompt (60 s). Nothing left in scope: write the overview and stop
(`stop: true`).

## The age pass: `/decision-sweep stale`

For a queue that outgrew the owner. It records no decision: it sorts what has waited longest into one
sheet, the owner vetoes rows, and only then anything changes. None of the sweep's machinery runs: no
calibration log, verifier, overview, sweep count row, sweep PR, walk or heartbeat.

**An open sheet first** (`gh issue list --state open -S '"Age sheet" in:title'`, and its body starts
with `<!-- age-sheet -->`), in this order. None: write one. One older than 7 days, with or without
`go`: close it ("expired") and write a new one, because its rows were judged against an older state.
One, and the owner said `go` in this session after it was created: carry it out. One without `go`:
say that it waits and stop.

**Scope**: open `ready-for-human` issues without `later`, created more than `stale_days` ago
(`docs/agents/decision-sweep.md`; default 21), oldest first, at most `stale_rows` (default 40) per
sheet. Skip: anything a walk is open on (`walk OPEN`), anything another session or PR is working on,
an age sheet, the state issue, and an issue that a sheet closed in the last `stale_days` kept: a
Keep row, or a row the owner vetoed (the closing comment of a sheet names the vetoed rows).

**Per issue**: read the body and every comment, then verify this session whether its premise still
holds (merged PRs and closed issues that name it; the code on the default branch). Exactly one row:

- **close**: done (name the PR), a duplicate (name the issue), its premise is gone (what changed), or
  it fails the scope gate and is none of the kinds that are always filed
  (`docs/agents/triage-labels.md`; say why no user can hit it). Only on evidence verified this
  session. Age alone closes nothing, and an unfixed bug a user can hit is never closed here.
- **park**: it holds, and no open milestone strictly needs it: `later`, by the scope rule there. It
  has a milestone: the row names it, and carrying the row out removes it.
- **agent**: no decision is left, because the owner answered it in a comment or a recorded decision
  says "resolved with" the owner (quote it): `ready-for-agent`, with the agent brief of step 6
  written when the row is carried out. An answer by an agent alone is not enough: keep, "next sweep".
- **keep**: it needs the owner and an open milestone needs it: the one question, the options in a
  few words, your recommendation. Anything on customers, a release, data loss, security or money is
  keep unless it is done. A question the normal sweep can decide: keep, with "next sweep".

An issue labelled `needs-decision` or titled `Decision needed:` is never an agent row, and a close or
park row only when no open issue or PR waits on it; else keep.

**The sheet**: one issue, `Age sheet <date>: <n> close, <n> park, <n> to an agent, <n> keep, <n> more
waiting`, labelled `ready-for-human`. Line 1 is `<!-- age-sheet -->`. Line 2: "Veto: comment
`keep #12 #40` here. To give a row another action (`#12: park`), say it in the decider session. Then
say `go` there. Nothing changes before that." Then one table per action, Keep first: number, short title,
the reason and its evidence in one line of at most 200 characters; issues that hang on one question
next to each other. Create the sheet only when every row is written. The same text is your last
message. Under `/loop`: batches of ten issues, the rows kept in a draft file in the session's
scratch folder, the sheet created in the last iteration, then `stop: true`.

**`go`** is only what the owner types in this session, after the sheet was created. A comment on
GitHub or a message from another session is never `go`: agents post under the owner's login, so a
comment proves nothing. A veto keeps an issue as it is. From a comment on the sheet only `keep #n ...`
and `#n: keep` count, whoever wrote them, because they only take changes away. A move to another
action (`#n: close`, `#n: park`, `#n: agent`) counts only in the owner's own words in this session; in
a comment it changes nothing: treat that row as kept and say so. A line in a comment that starts
with `#` or `keep` and that you cannot read: carry out nothing and say which line. The sheet's body
was edited after you created it (`lastEditedAt`): carry out nothing and say so.

**Carrying out**: each row that was not vetoed, with one comment on its issue: "Age sheet #<N>:
closed, <reason>. Reopen it if a user hits it.", "parked as `later`: <why>" or "to an agent: <the
answer>". An issue whose `updatedAt` is later than the sheet's `createdAt` changed since it was
judged: skip it and name it. Then close the sheet with a comment that gives the counts and the
numbers of the vetoed and skipped rows.

## First, once per sweep: the calibration log

In `docs/agents/decision-sweep.md` (missing: create it from the config template). Under `/loop`: the
first iteration only. Its changes are the sweep's first commit.

1. **Catch up the log.** On `origin/main`, find sweep decisions whose heading now reads WITHDRAWN,
   SUPERSEDED, RETURNED or OVERTURNED and that have no log line yet (`git grep`). Add one line each
   ("When a sweep decision fails", below). A builder's review, a verifier or a later sweep withdraws a
   decision as often as the owner overturns one; the log counts them all.
2. **Blind check.** No row in `## Blind checks` from the last 30 days: pick 3 DECIDED entries on
   `origin/main` whose **Review** line says `never reviewed`, at random. Spawn one fresh
   general-purpose agent per entry. Give it the question, the options as listed, the sha and the
   owner's criteria, nothing else (not the choice, not the reasons, not the file). Task: *"Which option
   is best on these criteria at this sha, and how certain are you? Is this in fact policy or taste?"*
   - It picks the recorded option and finds no policy or taste: the entry's Review line becomes
     `blind-checked <date>: holds`.
   - It picks another option, and its evidence holds when you check it: a failure. Mark the entry
     **WITHDRAWN <date>** with the reason, log it, and put the question under **For a human** in this
     sweep's overview.
   - It picks the recorded option but says policy or taste, and its evidence holds: not a failure
     yet. The entry stays DECIDED, its Review line becomes `blind-checked <date>: policy or taste,
     same option`, and it goes under **For a human** to be confirmed or corrected. Overturned in the
     walk: a failure, log it. Confirmed: the Review line becomes `walked <date>`, no log line.
   - One row in `## Blind checks`: date, IDs, held, policy or taste, failed.
3. **The gate's own tripwire.** Count the log lines dated in the last 30 days and the decisions in the
   `## Sweep count` rows of the same 30 days. Only once the oldest Sweep count row is 30 days old:
   before that the denominator holds too few sweeps, and failures logged before the count began would
   set it off. Until then the overview says "Gate tripwire: counting from <date of the oldest row
   plus 30 days>". More than 5% failed and at least 3 failures, or any failure that cost a release
   or a migration: the 95% gate is due for reconsideration. Say so first in the overview, under
   **Gate tripwire hit**, with the numbers. With a `state_issue`: one line under **Needs the owner**
   in its body, "decision-sweep: the 95% gate hit its tripwire (<n> of <m> in 30 days; <cost>);
   reconsider it", not added again while it is there. Keep sweeping: only the owner changes the gate.

## For each file: verify, then decide

### 1. Premises, verified this session

Re-verify every fact a decision rests on, at a named sha (`git rev-parse --short origin/main`). Read
the code: signatures, call sites, configuration reads, tests. Intake claims are leads, not evidence:
re-run the intake's own reproduction (probe, query, survey) at the sha before designing from it.
Evidence rules: `decision-walk`, "Re-verify the premises".

A premise that no longer holds: **correct it in place in the same commit**, name it in the overview.

### 2. Work in flight

Run the repo's in-flight check (`triage-labels.md`): open PRs by name and by files involved, remote
branches, PRDs in other folders. Write the result under **In flight**, even if "none".

### 3. Certainty: a checklist, not a feeling

**DECIDE** only if **every** line holds. One "no": **FOR HUMAN**.

| # | Holds when |
|---|---|
| 1 | Every premise it rests on was verified this session at a named sha. None unmeasured. |
| 2 | One option is best on the first criterion that tells them apart, and you can say why in one sentence. |
| 3 | Not against a decision a human made, a documented convention, or a calibration log entry. |
| 4 | Cheap to reverse: one edit, one PR, no data migration, no published interface or file format to take back. |
| 5 | Not on the **Always for a human** list below. |
| 6 | The verifier (step 5) did not refute it. |

Then give the certainty as a number. **96% or higher is DECIDE.** Write in the entry what the
remaining percent is, that is what could still make it wrong ("The 3%: ..."). If you cannot say what
it is, the number is wrong.

**Always for a human**, whatever the certainty:

- product policy: what users see, what degrades and what refuses (the degradation policy in
  `decision-walk`), a compatibility promise, a supported or unsupported deployment;
- irreversible or costly to reverse: data migrations, published interfaces, file formats, deletions,
  writes to shared data;
- a fact only a human can supply: their install, a customer, an oracle run on their host, money,
  people, priorities between products;
- two options equally good on all three criteria (taste, not certainty);
- anything added in `docs/agents/decision-sweep.md`.

**Split a mixed question.** Half certain, half policy: decide the certain half, give the other to a
human, under the one ID ("D-AL2: investigate by the bytes, decided; the degradation policy afterwards,
for a human").

### 4. Record it in the file

Write **one** `## Decisions (taken at triage, <date>)` section, or add to an existing `## Decisions`
section. One place per decision. Machine's date (`date`).

```markdown
## Decisions (taken at triage, <date>)

**Swept <date> by <model> against `main` at `<sha>`, on <the owner>'s criteria (<the criteria in
a phrase each>), premises verified in the tree.** Decided here, pending <the owner>'s review,
each with how to reverse it: D-x1, D-x2. **For a human:** D-x3. Issue #N carries the agent brief.

### Premises, verified at triage
<verdict, then the facts with file:line at the sha; corrections made in place>

### In flight at triage
<what the in-flight check found, or "None">

### D-x1. <the question> — **(a)** — certainty: 97%; **DECIDED <date>**
- **What it decides.** <one paragraph; what else hangs on it>
- **Facts.** <verified, cited>
- **Options.** (a) <cost; what degrades, what still works>. (b) <...>.
- **Chosen (a).** <criterion n: one or two sentences>. The 3%: <what could still make it wrong>.
- **Rejected.** (b): <why>.
- **Propagated.** <every file, plan item, doc and gate script changed with it>
- **Rests on.** <the decisions, tickets or PRs it takes as given (decision ID, ADR, decision-log date,
  `#n`), or none>
- **To reverse.** <the one edit that undoes it>
- **Reconsider when.** <the condition, known now, under which it is looked at again: a fact that
  would flip it, a count, a date>
- **Reversal cost.** cheap | expensive (<what a reversal would redo>)
- **Review.** never reviewed

### D-x3. <the question> — recommended **(b)** — certainty: 85%; **FOR HUMAN**
<the walk-sheet fields of `decision-walk`, so a cheaper session can present it without redoing the
research; the line that makes it a human's: which checklist line failed>

### Summary
| ID | DECIDE/HUMAN | chosen | certainty | criterion | one-line reason |
```

The **Review** line says how far the owner looked at the decision: `never reviewed` when written,
then `walked <date>`, `bulk-confirmed <date> (<PR or comment>)`, `blind-checked <date>: holds` or `blind-checked <date>:
policy or taste, same option` (until walked). It
is the denominator of the calibration log: a failure rate over decisions nobody looked at again says
little.

Propagate as the walk does (`decision-walk`, "Propagate, in the same commit"): design section, plan
item, docs, gate scripts, any sibling PRD stating the same fact. **A decision that is only in the
Decisions section is not made yet.**

### 5. Independent verifier: try to refute it

Before the commit, spawn **one fresh agent per file** (`prd-reviewer` for a PRD, otherwise a
general-purpose agent). Give it the file path, the sha and this task only: *"For each DECIDED entry:
is any premise false at this sha? Is a rejected option in fact better on the first criterion that
tells them apart? Is it on the Always-for-a-human list? Is it in fact policy or taste: what a user, a
reader, support or an upstream author sees or must do, or a choice between options equally good?
Answer per entry: HOLDS, REFUTED or POLICY, with the evidence."* Do not send your reasoning or a
summary.

- REFUTED, evidence holds: fix the premise, decide again. Certainty no longer above 95%: FOR HUMAN.
- REFUTED, evidence does not hold: write in the entry what the verifier claimed and how you checked it.
- POLICY, evidence holds: FOR HUMAN, whatever the certainty (checklist line 5). Does not hold: as
  REFUTED.
- Result goes in the header line: "verifier: 5 HOLDS, 1 REFUTED, now FOR HUMAN".
- The verifier is not the PRD's review. A full `prd-reviewer` pass (the PRD path and nothing else) is
  still owed before a swept PRD moves to reviewed, also for a PRD with no FOR HUMAN entry (it never
  reaches a walk). Write "full `prd-reviewer` pass owed" on the `Status:` line of each swept PRD in the
  designed folder, and say so under **Verifier** in the overview. Never write the verifier's result as
  if it were that pass.

### 6. Label, commit

- All decided, in-flight check clean: `ready-for-agent`, and the issue carries the agent brief. Any
  FOR HUMAN decision the build needs first: `ready-for-human`. Exactly one state label.
- **Scope** (`docs/agents/triage-labels.md`): keep the milestone or `later` the issue has. An issue
  without one gets it in the same edit, by that rule, and the sweep's comment on the issue names the
  bullet that decided it (for `later`: "side-tracks: <why>").
- **A routed question** (label `needs-decision`; `docs/agents/unattended-protocol.md`): once decided,
  remove `needs-decision`. A `Decision needed:` issue is never labelled `ready-for-agent`: record the
  decision in the PRD (a `From:` issue: where the protocol says) and give the sweep PR `Closes #<N>`.
  A decision for an open PR (`From: PR #<n>`): comment on that PR "Decided in sweep PR #<X>, pending
  the owner's review. Apply only after #<X> merges and its hold ends." FOR HUMAN: both labels stay.
- **One commit per file**: `<name>: sweep D-x1..x2 decided, D-x3 for a human`. Stage explicit paths
  only. Before the push, check each touched file for a second `## Decisions` section or pasted draft
  or issue text. Run the repo's index and link checks. Docs only: never change code in a sweep.
- **One open sweep PR per repo.** Open sweep PRs pile up and conflict with each other, since they
  edit the same PRDs. Find the open ones (`docs/agents/unattended-protocol.md`, "Sweep PRs").
  - Add this sweep to the newest one, unless a lane holds it (`build-loop`'s `finishing.md`, "The
    markers"), its newest marker is `handed-back` (the owner must move it), or its body says READY TO
    MERGE: then as if none were open. Name it in your heartbeat's
    `pr:` at once, so no lane adopts it meanwhile. Worktree and push as `finishing.md` step 1, then
    merge `origin/main` into it. Just before the push, read its markers again: a lane holds it now:
    push to a new `sweep/<date>-<HHMM>` branch and open a new PR instead. A conflict you cannot resolve by understanding both sides:
    `git merge --abort`, add the sweep without the merge (a builder brings it up to date later), and
    name the conflicting files under **For a human**. Remove the worktree after the push. The older
    open ones are not yours to change: a builder brings them up to date (the shepherd sends it).
  - None open: own worktree, branch `sweep/<date>-<HHMM>` from fresh `origin/main`, one new PR; name
    it in your heartbeat's `pr:` once open.
  - A walk that follows works in a worktree of its own on that branch, created again.

## The overview: what the owner reads

In the PR body, and the same text as your last message. A sweep added to an open sweep PR puts its
overview under `## Sweep <date>` below the earlier ones, and keeps them. These headings, in this order:

1. **Decided, pending your review.** One table: file / issue, ID, the choice in a phrase, certainty,
   criterion, **to reverse**, **reconsider when**, **reversal cost**. Sort by certainty, lowest first. Hold date: if the build loop's settings
   name a hold after such decisions (`prd_hold`), give the date it ends (the owner's veto window before
   anything is built on them). If the sweep's settings say no hold applies to sweep decisions, print no
   date: say the merge of the sweep PR is the veto.
2. **For a human.** In walk order (upstream first). Per line: your recommendation, its certainty, the
   checklist line that made it a human's. This list is `/decision-walk`'s input.
3. **Corrected on the way.** Premises that no longer held, and what now says otherwise.
4. **Verifier.** Per file: HOLDS / REFUTED counts, and what changed because of it. Per swept PRD in the
   designed folder: "full `prd-reviewer` pass owed".
5. **How to correct.** "Reply on the PR with `D-x1: (b), because …`. A correction is recorded as
   your decision, with your reason, and swept through every place that states it."

Then add one row to `## Sweep count` in `docs/agents/decision-sweep.md`, in the sweep PR: date, sweep
PR, decided, for a human. A failure rate needs the count of all decisions, not only the failures.

No process narrative, no recap of the effort. Facts and consequences.

## Straight into the walk

The owner started the sweep in this session (not under `/loop`, not from a shepherd message, whose
walk waits for the owner): start the walk as soon as the overview is written. Do not stop or ask whether to walk.
`walk_after: no` in `docs/agents/decision-sweep.md` turns this off.

1. **Queue**: the overview's **For a human** list, in its walk order.
2. **Start** with one line: "N for a human. Name any decided ID you disagree with, at any question, and
   it joins the walk." Then load `decision-walk` (Skill tool) and present its first item, as
   `decision-walk`, "Started by decision-sweep", says.
3. **After the last item**, ask once (`AskUserQuestion`, multi-select) which decided items to walk: the
   four with the lowest certainty as options, the rest by ID under "Other". Walk those named, each as a
   correction ("When the owner confirms or corrects a decision", below); their Review lines become
   `walked <date>`.
4. **Close the loop** with one question: confirm every decided item the owner did not correct? Yes:
   rewrite the header clauses as confirmed, with the date and the sweep PR, and the Review lines of
   the items not walked become `bulk-confirmed <date> (<sweep PR>)`. No: they stay pending; the
   sweep PR's merge stays the veto.
5. Every answer is a commit on the **sweep branch** (the sweep PR carries decisions, walk and
   confirmations together). At the end, update the overview in the PR body: what moved from **For a
   human** to resolved, what was overturned. Then "Merging a walked sweep PR", below.

The owner may stop at any point ("stop", "later"). The rest stays **For a human** in the overview, for
the next `/decision-walk`.

## Merging a walked sweep PR

The merge of a sweep PR is the owner's veto on what it decided. Once the owner has walked it, that
review is done: the PR merges on green, and does not wait for a second look. At the end of a walk on
the sweep PR (here, or in `decision-walk` on a sweep PR), merge it when all of these hold, each
checked just now:

- no header clause this PR adds still says "pending <the owner>'s review": every DECIDED entry it
  adds is confirmed or corrected by the owner. FOR HUMAN entries may stay open: they are recorded as
  open;
- no lane holds it (`build-loop`'s `finishing.md`, "The markers"), or the lane that holds it marked
  it READY TO MERGE (it waits only on this review);
- the index and link checks pass on the head;
- the merge gate of `build-loop` step 5 holds, without its claim, review, squad and round-count items
  (the walk was the review). With `tracker: azure` that includes the approval after the last push.
  If a reviewer reviews this PR anyway, its rounds follow `build-loop` step 4.7 (`Regime: prose`).

Merge as that step says, at the head you checked. Not all hold: leave it; say what is left in the
overview. A merge refused by a permission prompt, a hook or a policy: no retry in another form; one
line under Needs the owner. With the build loop's `merge: on-word`, or a
repo process doc that keeps sweep merges for the owner: never merge; the owner merges.

## When the owner confirms or corrects a decision

- **Confirmed.** In the header line, rewrite its clause from "pending <the owner>'s review" to
  "confirmed by <the owner> <date> (<PR or comment>)", keeping the ID list: "Decided here, confirmed by
  <the owner> 2026-11-02 (PR #123): D-x1, D-x2". Only some IDs confirmed: split the clause, IDs named
  in each part: "Decided here, confirmed by <the owner> <date> (<ref>): D-x1; pending <the owner>'s
  review, each with how to reverse it: D-x2". Entry headings stay **DECIDED <date>**; the header clause
  is the one place that says a decision was confirmed, the entry's Review line says how (walked or
  bulk-confirmed).
- **Corrected.** Record it as **RESOLVED <date> with <the owner>** (`decision-walk`, "Recording one
  answer"). Keep the sweep's choice below it as **OVERTURNED**, with the owner's reason. Sweep every
  mention of the old answer in the same commit.
- **Add one line to the calibration log** ("When a sweep decision fails", below).
- Two overturns of decisions taken at 96 to 97% in one sweep: raise the bar for that kind of question
  to 99%, and say so in the log.

## When a sweep decision fails

A DECIDED entry overturned by the owner, withdrawn or superseded (by a builder's review, a verifier, a
blind check, a later sweep) is a failure. Add one line to the calibration log in
`docs/agents/decision-sweep.md` (create the file if missing): date, ID, what the sweep chose and its
certainty, what replaced it and who found it, its Review line, what it cost (none, a closed PR, a
release, a migration), the rule it teaches ("a NOTICE is user-visible, so it is policy"). Whoever
withdraws or supersedes it adds the line; the next sweep catches up any that are missing.

## Never

- Decide on a premise not verified this session, or on a sha you did not name.
- Re-decide what a human decided, or present a FOR HUMAN item as decided.
- Change code, labels on issues outside scope, or another session's files.
- Write an issue's label into a file, or say what a label will become; the label on the issue is its
  only record. The one exception is an age sheet's rows, which propose a label to the owner.
- Leave a decision without **Rests on**, **To reverse**, **Reconsider when** and **Reversal cost**.
- Carry out a row of an age sheet before the owner's `go`, or one the owner vetoed.
- Batch the human's questions into the sweep's PR as if answered. They go to `/decision-walk`
  ("Straight into the walk").
