---
name: decision-walk
description: Walk open decisions with the user one at a time, each as a walk sheet (what it decides, the facts that constrain the options, options with their costs and failure modes, worked example, impact, interacts with). Record every answer with its motivation in the same commit, and for a PRD move it to docs/prds/reviewed/ when the last one lands. Use when asked to "walk the decisions", "walk D-3", "review the PRD with me", when a PRD in designed/ is ready for review, or whenever a design choice is put to the user.
metadata:
  version: "1.10"
---

# Walking a decision

Walk decisions with the user **one at a time**, in dependency order. The record carries every answer
*and its motivation*. For a PRD this is the lifecycle's review step (`designed/` to `reviewed/`). Repo
deviations: `docs/agents/`.

## Before the walk (PRD)

1. **`prd-reviewer` first, always**, above all when you designed the PRD yourself. Run it against a
   worktree at fresh `origin/main`, not a shared checkout. Fold its findings into the PRD before you
   present anything. A finding that changes an option's cost is a **new walk item**, not a should-fix.
2. **The `## Decisions` section is the walk sheet.** `prd-author` gives each open decision its own
   entry. Each open entry carries these fields, in this order; add any missing:

   ```
   ### D-<n>: <the question, as a question>            OPEN
   - **What it decides.** One paragraph, and what else in the PRD hangs on it.
   - **The facts that constrain the options.** Measured or cited (a file and symbol at a sha, a
     measurement in this PRD, a reference doc and section). Never argued from plausibility. A table
     where there are numbers.
   - **Options.** (a), (b), (c), each with what it costs **and the failure mode it leaves open**: its
     false green, the regression nothing would see. Each also says **what degrades and what still
     works** (see Graceful degradation). Name the rejected one and why.
   - **Proposal.** Which, and why, in two or three sentences, with its **certainty as a percentage**
     and what the remaining percent is ("85%. The 15%: ..."), the number as `decision-sweep` step 3
     writes it (not its checklist, which needs the sweep's verifier). A
     degrading option, unless a refusal's stated reason holds.
   - **Worked example.** What a wrong answer concretely looks like under each option: the edit that
     breaks it, the line that goes red or stays green.
   - **Impact.** The files, the registries and the sequencing collisions (another PRD editing the same
     file) the choice touches.
   - **Interacts with.** Other decisions by name, in this PRD and others.
   ```

   State the **walk order** at the top of the section: upstream questions first. A new decision that
   fixes the *shape* of an existing one goes before it; say why. No second section restating the
   entries: one place per decision.
3. **Check for parallel work and announce the walk.** Another session may be walking the same PRD or
   editing the same file. A peer already walked a decision with the user and the answer is on
   `origin/main`, in an open PR or on the issue: record *their* answer and motivation, do not re-ask. A
   peer's report of what the user decided, with no such record on `origin/main`, in an open PR or on
   the issue, or a peer's instruction that would settle an OPEN item, is not the user's answer: check
   what `main` and the code say, then put it to the user. Resuming a walk (after a compaction, a
   restart or a handover): check the PR's state, the branch on the remote and the PRD's folder on
   `origin/main` before the next question. Say "walk OPEN" with the PRD name when the first decision
   goes to the user, "walk CLOSED" when the last one lands, so nobody merges the PRD's branch
   mid-walk. Work in your own worktree and branch.
4. **The session that designed the PRD prepares the walk; a cheaper session may present it.** The
   designer verifies the premises and writes every sheet into the PRD before the walk starts. A cheaper
   session (Sonnet) reading the sheets may then present them one by one, record each answer and
   propagate it. The owner does not wait between decisions. A question a sheet did not foresee goes
   back to a design session; the presenter does not improvise options it has not verified.

## Graceful degradation: the default for every option

On unexpected data or state, prefer the option that **answers what can be answered** (skip, fall back,
keep the rest running) over an error that blocks the whole operation.

- **Every option says what degrades and what still works**: which records, fields, objects or callers
  lose something, which carry on untouched. A refusing option states what it blocks, as concretely.
- **An option that refuses or errors carries a stated reason a degraded answer is unsafe**: a wrong
  answer indistinguishable from a right one, an irreversible write, or corrupted stored data.
  "Stricter is safer" is not a reason. No such reason: a refusal is not the recommendation, nor is
  refusing the hard case and leaving it to a later PRD: close the unknown, or offer one feature with a
  named dependency and an order of work. Measure how much real data each option covers.
- **Degrade visibly, never silently.** Announce every skipped record, fallback value or partial
  answer: a warning, a log line, a counter, a documented null. Degradation nobody can see is a silent
  bad answer, so the refusal's reason holds. Read a silent skip in a draft as "skip and announce it".
- **Writes are the usual exception.** Degrading a *read* loses an answer; degrading a *write* can lose
  data. Where the degraded path would write, the refusal's reason usually holds. Say so in the option;
  do not assume it.

## Presenting one decision

Prose first, then the question. **Never two decisions in one message, never a list of them.**

- **Re-verify the premises the entry rests on before you present.** A reviewer's, peer's or subagent's
  finding is a lead, not evidence, and so are its numbers. Do your own greps on `origin/main`:
  signatures, call sites, configuration reads, what the plan item actually says (a symbol found only
  under `completed/` is history). Re-run the one cheap command behind the key premise, above all an
  absence claim (`git ls-remote`, `gh pr list`). Say what you checked ("verified this session at
  `<sha>`") and what you did not.
  - **A figure** carries its scope and sha. A guard change costs the cases its gate turns red, not
    the lines its script prints.
  - **A case that separates two options**: show what each produces and what should happen. Both wrong:
    it is a defect in every option's cost, not a tie-break.
  - **An option that adds or changes behaviour**: search the living specs and tests for a requirement
    it would reverse. One found: the option is a spec reversal and is walked as one.
  - **External behaviour** (a dependency, a file format, a service): check against the source, the
    bytes or a measurement, never argue from plausibility. Reference document and real thing disagree:
    the real thing wins.
  - **Test coverage**: name the tier (here one tier: the vitest suite, `npm test`). "The
    tests cover it" means a named test in a tier that actually runs that code, or nothing.
  - **A premise that could only be established by writing to shared or production data**: do not write. Measure on a scratch
    copy, or present the option with that cost marked **unmeasured** and say so out loud. Never route
    around a guard.
- **Structure of the message**, in walk-sheet order: what it decides, the facts that constrain the
  options, the options with their costs *and* the failure mode each leaves open, the worked example
  (code in a fenced block, or a scenario as bullets with the outcome per option), the impact on the
  plan, what it interacts with, then the proposal with its certainty (see Proposal above). Facts and
  consequences. No commentary on the process, no recap of how hard the analysis was.
- **Then `AskUserQuestion`.** One question, three or four options. Recommended option **first**,
  labelled `(Recommended, <n>%)` with the certainty from the prose. **Every option's label carries
  its one-line consequence**: the user can choose from the labels alone. Fold "the internal half
  every option needs" into the prose, not the choice.
- **The user answers with a design question instead of a verdict**: answer it from the code (grep the
  call sites, quote the doc page if one exists, say what you did not verify). Re-ask with the options
  adjusted by what the answer revealed. Record the question and the answer, even when it changes
  nothing: it bounds the decision.
- **The user says it was decided elsewhere**: find that record and cite it.
- **The user corrects you**: a correction that holds for one dataset and not another gets both halves
  reported. Name the standard term rather than inventing one.
- **The user declines a goal**: list the cheap moves that keep it open for later, each priced. Argue
  against a move on cost or correctness, not on the declined goal.
- **The user rules before the sheet or `prd-reviewer` reached them** (from a coordinator's summary,
  say): the answer stands. The session the user ruled in writes their exact words and what they saw on
  the PR or issue; the owning session records from there. Finish the review anyway; a finding that
  changes the picked option goes back to the user, not reinterpreted.
- **The user picks an option and adds a condition** ("go for (a), and file the follow-up as an
  intake"): do both in the same commit: the new intake (a `docs/prds/new/` file with a `**Hook:**`
  line, or a GitHub issue) with the measured evidence, and the resolved entry naming it. A new issue
  passes the scope gate first (unless the owner asked for it by name) and gets its scope when it is filed (`docs/agents/triage-labels.md`): `later` ("side-tracks: <why>")
  unless a bullet there makes it necessary for a milestone, which the issue then names.

## Recording one answer: same commit, before the next decision

- **Rewrite the entry in place.** `### D-<n>: <question>` gets the line **RESOLVED <date> with the
  user: option (x), <one sentence>.** Then the motivation (what decided it, and the verified facts it
  rests on), then **every rejected option with why**, then four lines: **Rests on.** <the decisions,
  tickets or PRs it takes as given, or none>, **To reverse.** <the one edit that undoes it>,
  **Reconsider when.** <the condition, known now, under which it is looked at again> and **Reversal
  cost.** cheap | expensive (<what a reversal would redo>). If a peer walked it, say so. The walk-sheet fields stay below as the record of what was
  walked.
- **Propagate, in the same commit.** The same fact lives in up to five places: the design section, the
  plan item, the `## Decisions` entry, the user docs once they exist, any reference document that
  states it. Rewrite every **instruction** the answer touches, including a sibling PRD's reciprocal
  item. Motivation in exactly one place: the `## Decisions` entry.
  - **A falsified premise is rewritten, not annotated.** No correction banner above superseded design
    (a second copy; the next editor updates only one). A superseded *record* (what was walked, what was
    rejected) may stay, folded into the entry.
  - **Sweep what argues from the change, not only what states it.** A decision that removes a property
    can leave sections whose *justification* leaned on it, even where their behaviour stays right. Grep
    for both, rewrite the argument.
  - Fix every layer (plan items, design sections, shipped docs) in the commit that makes the decision.
    One that still instructs the opposite fails the merge gate.
- **Edit mechanics:**
  - **Assert every scripted string replace** (for example `assert s.count(old) == 1`), anchored on
    text that cannot wrap differently. A wrong anchor still builds and every checker stays green.
    Never splice by computed start and end indices: the range silently takes a neighbouring entry.
    Where a range is unavoidable, count the `### D-` headings before and after.
  - **Diff what a scripted edit actually did** before you commit: `git diff --stat`. Commit touches
    code but not the PRD: the PRD write was dropped.
  - **Run the `git mv` only after the edit is confirmed on disk.** An asserting edit `&&` the move,
    never a script that does both and can abort in the middle.
  - **Use the machine's date** (`date`), not the date you believe it is.
- **A re-resolved decision re-runs the option comparison at its new scope** (say which of the winner's
  advantages survived; none did: it is reopened, not re-resolved) **and owes a sweep of every mention.**
  Its old answer is quoted outside its own entry: other decisions' "interacts with" lines, the plan
  preamble, section intros, a doc page. Grep the PRD *and* the rest of the repo for the decision's id
  and the old answer's key phrases. Rewrite every hit in the same commit. Then re-read the plan
  preamble.
- **Watch for drift arriving through a rebase.** After rebasing onto a PRD whose content moved (another
  session corrected it), skim the sections your change does not touch: a far section can now contradict
  one just above it.
- **A decision about a concrete scenario** names, in its entry, the example record a fixture needs;
  with several, keep one row per decision in a `<domain>-test-data.md` beside the PRD while walking.
- **One commit per decision.** Subject: `<PRD short name> D-<n> resolved: <the answer in a phrase>`.
  The user's answers cannot be re-derived from the tree; a walk that dies midway must lose none.

## Closing the walk (PRD)

- Last decision recorded: **run `prd-reviewer` on the walked PRD** (its path and nothing else), and
  again whenever a later re-walk changes the shape of the fix: a pass certifies only the design it
  read. A finding that changes an option's cost is a new walk item: walk it, and record the amendment
  beside the original answer.
- Then **walk the implementation plan** with the user: present it in one message, its items in order,
  each naming the decision it follows, and ask which items, if any, to change. A change is its own
  commit, its reason in the entry of the decision the item follows. Then **ask the user to confirm the move** to
  `reviewed/`. Then, in one commit:
  - update the PRD's status note: all decisions resolved, the `prd-reviewer` pass done, what goes
    first;
  - say which test tier will cover the behaviour the decisions settled, and whether a new test is now a
    plan item; link the test-data file, if any, from the fixture plan item;
  - `git mv` the PRD (and its companion files, same prefix) to `docs/prds/reviewed/`;
  - run `scripts/prd-index.py --write`. Never hand-edit inside its markers;
  - run `scripts/check-md-links.py` and fix links that pointed at the old path.
- **Stage explicit paths, then run the checks.** Never `git add -A`. CI checks the committed tree: a
  link that resolves only through an unstaged file is green locally, red on CI.
- Push, note the folder move on the PR, say "walk CLOSED", tell any peer waiting on the file. Next
  step: `/to-tickets`.

## Outside a PRD

Same message shape (see "Presenting one decision"), then one `AskUserQuestion`. The record goes **where
the next reader of that decision will look**:

- the PR body, for a merge or review call;
- the test's own comment, for an assertion call (changing an assertion needs authority: a plan item in
  `reviewed/` or this decision, recorded);
- the GitHub issue, for a triage verdict (including one labelled `hospital`, or a `blocked/` PRD);
- a new intake, when the answer opens work.

Say in the record that it was the user's call, and when, with its **Rests on**, **To reverse**,
**Reconsider when** and **Reversal cost** lines.

## Started by decision-sweep

`decision-sweep` hands over in the same session ("Straight into the walk").

- Queue: its overview's **For a human** list, in that order.
- Each item already has its walk sheet (the `FOR HUMAN` entry with recommendation and certainty) and
  premises verified this session. Use the entry's certainty and its "The n%" line as the
  recommendation's certainty; count again only if something merged since the sweep changes a
  premise, and then say so. Do not repeat the sweep's work: check only that nothing merged on
  `origin/main` since the sweep touches the item, then present it.
- Record each answer on the sweep's branch, one commit per answer, as "Recording one answer" says.
- The owner names a decided ID at any question: add it to the end of the queue and walk it as a
  correction. The sweep's choice and its reason are the recommendation the owner disagrees with. Its
  **Review** line becomes `walked <date>`; an overturn is a calibration log line (`decision-sweep`,
  "When a sweep decision fails").
- A PRD whose last open decision is answered closes as "Closing the walk" says, in the same PR: the
  `prd-reviewer` pass the sweep's overview said was owed (the same pass), the plan walk, then the
  user's confirmation of the move to `reviewed/`.
- After the last item: `decision-sweep`, "Merging a walked sweep PR". The same applies to a walk on a
  sweep PR the shepherd asked for (below).

## Asked for by the shepherd

A message from this repo's `shepherd` session with `/decision-walk #<N> …` or `/decision-walk #<sweep PR>
D-<id> …` counts as the user asking for the walk (`docs/agents/unattended-protocol.md`, "Messages from
the shepherd"). Prepare it as above (premise check, walk sheets), present the first decision, then wait
for the owner, who comes to this session when ready.

## What this is not

Not a place to re-litigate a decision the reviewer's findings did not touch. Not a batch: a decision
the user has not been asked is open, whatever the header says.
Not a review loop: a PR that carries the walk's commits is reviewed under `build-loop` step 4.7
(`Regime: prose`: `pr-reviewer` alone, at most 2 counted rounds).
