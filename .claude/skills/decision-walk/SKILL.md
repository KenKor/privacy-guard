---
name: decision-walk
description: Walk open decisions with the user one at a time, each as a walk sheet (what it decides, the facts that constrain the options, options with their costs and failure modes, worked example, impact, interacts with). Record every answer with its motivation in the same commit, and for a PRD move it to docs/prds/reviewed/ when the last one lands. Use when asked to "walk the decisions", "walk D-3", "review the PRD with me", when a PRD in designed/ is ready for review, or whenever a design choice is put to the user.
metadata:
  version: "1.0"
---

# Walking a decision

Walk decisions with the user **one at a time**, in dependency order. Leave the record carrying every
answer *and its motivation*. For a PRD this is the review step of the lifecycle made concrete
(`designed/` to `reviewed/`). The repo's deviations are in `docs/agents/`.

## Before the walk (PRD)

1. **`prd-reviewer` first, always.** A decision walked on a false premise wastes the user's review, and
   then it ships. Run the agent against a worktree at fresh `origin/main`, not a shared checkout. Fold
   its findings into the PRD before you present anything. A finding that changes an option's cost is a
   **new walk item**, not a should-fix. This holds most when you designed the PRD yourself: nothing
   inside your own review loop forces the pause.
2. **The `## Decisions` section is the walk sheet.** `prd-author` gives each open decision its own
   entry. Make sure each open entry carries these fields, in this order, and add them where missing:

   ```
   ### D-<n>: <the question, as a question>            OPEN
   - **What it decides.** One paragraph, and what else in the PRD hangs on it.
   - **The facts that constrain the options.** Measured or cited (a file and symbol at a sha, a
     measurement in this PRD, a reference doc and section). Never argued from plausibility. A table
     where there are numbers.
   - **Options.** (a), (b), (c), each with what it costs **and the failure mode it leaves open**: its
     false green, the regression nothing would see. Each also says **what degrades and what still
     works** (see Graceful degradation). Name the rejected one and why.
   - **Proposal.** Which, and why, in two or three sentences. A degrading option, unless a refusal's
     stated reason holds.
   - **Worked example.** What a wrong answer concretely looks like under each option: the edit that
     breaks it, the line that goes red or stays green.
   - **Impact.** The files, the registries and the sequencing collisions (another PRD editing the same
     file) the choice touches.
   - **Interacts with.** Other decisions by name, in this PRD and others.
   ```

   State the **walk order** at the top of the section: upstream questions first. A new decision that
   fixes the *shape* of an existing one goes before it. Say why. Do not add a second section restating
   the entries: one place per decision.
3. **Check for parallel work and announce the walk.** Another session may be walking the same PRD or
   editing the same file. If a peer has already walked a decision with the user, record *their* answer
   and motivation; do not re-ask. Say "walk OPEN" with the PRD name when the first decision goes to the
   user, and "walk CLOSED" when the last one lands, so nobody merges the PRD's branch mid-walk. Work in
   your own worktree and branch.
4. **The session that designed the PRD prepares the walk; a cheaper session may present it.** The
   designer already holds the context: it has read the code and built the options, so it verifies the
   premises and writes every sheet into the PRD before the walk starts. Presenting the sheets one by
   one, recording each answer and propagating it can then run in a cheaper session (Sonnet) that
   reads the sheets. The owner does not wait between decisions. A question a sheet did not foresee goes
   back to a design session; the presenter does not improvise options it has not verified.

## Graceful degradation: the default for every option

When data or state is unexpected, prefer the option that **answers what can be answered** (skip, fall
back, keep the rest running) over an error that blocks the whole operation. Errors that block
everything stop people doing crucial work.

- **Every option says what degrades and what still works.** Not only its failure mode: which records,
  fields, objects or callers lose something, and which carry on untouched. A refusing option states
  what it blocks, as concretely.
- **An option that refuses or errors carries a stated reason a degraded answer is unsafe.** It would be
  a wrong answer indistinguishable from a right one, it would write something irreversible, or it would
  corrupt stored data. "Stricter is safer" is not a reason. Without such a reason, a refusal is not the
  recommendation.
- **Degrade visibly, never silently.** A bad answer must never look like a good one. A skipped record,
  a fallback value or a partial answer is announced: a warning, a log line, a counter, a documented
  null. An option whose degradation nobody can see is a silent bad answer, and then the refusal's
  reason holds. A silent skip in a draft is taken as "skip and announce it".
- **Writes are the usual exception.** Degrading a *read* loses an answer. Degrading a *write* can lose
  data. Where the degraded path would write, the refusal's reason usually holds. Say so in the option
  rather than assume it.

## Presenting one decision

Prose first, then the question. **Never two decisions in one message, never a list of them.**

- **Re-verify the premises the entry rests on before you present.** The reviewer's summary is a lead,
  not evidence. The walk is where a stale claim becomes a wrong decision. Do your own greps: signatures,
  call sites, configuration reads, what the plan item actually says. Say what you checked ("verified
  this session at `<sha>`") and what you did not.
  - A premise about **external behaviour** (a dependency, a file format, a service) is checked against
    the source, the bytes or a measurement, never argued from plausibility. Where a reference document
    and the real thing disagree, the real thing wins.
  - A premise about **test coverage** names its tier (here one tier: vitest in `test/`,
    run by `npm test`). "The tests cover it" means a named test in a tier that actually runs that code, or
    it means nothing.
  - A premise that could only be established by **writing to shared or production data** is not
    established by writing. Either it was measured on a scratch copy, or you present the option with
    that cost marked **unmeasured** and say so out loud. Never route around a guard.
- **Structure of the message**, in the walk-sheet order: what it decides, the facts that constrain the
  options, the options with their costs *and* the failure mode each leaves open, the worked example
  (code in a fenced block, or a scenario as bullets with the outcome per option), the impact on the
  plan, what it interacts with. Facts and consequences. No commentary on the process, no recap of how
  hard the analysis was.
- **Then `AskUserQuestion`.** One question. The recommended option **first**, labelled
  `(Recommended)`. **Every option's label carries its one-line consequence**: the user should be able
  to choose from the labels alone. Three or four options. Fold "the internal half every option needs"
  into the prose, not the choice.
- **When the user answers with a design question instead of a verdict**, answer it from the code: grep
  the call sites, quote the doc page if one exists, say what you did not verify. Then re-ask with the
  options adjusted by what the answer revealed. Record the question and the answer. It bounds the
  decision even when it changes nothing.
- **When the user picks an option and adds a condition** ("go for (a), but file the rest as its own
  PRD"), do both in the same commit: the new intake (a `docs/prds/new/` file with a `**Hook:**` line,
  or a GitHub issue) with the measured evidence, and the resolved entry naming it.

## Recording one answer: same commit, before the next decision

- **Rewrite the entry in place.** `### D-<n>: <question>` gets the line **RESOLVED <date> with the
  user: option (x), <one sentence>.** Then the motivation (what decided it, and the verified facts it
  rests on), then **every rejected option with why**. If a peer walked it, say so. The walk-sheet
  fields stay below as the record of what was walked.
- **Propagate, in the same commit.** The same fact lives in up to five places: the design section, the
  plan item, the `## Decisions` entry, the user docs once they exist, and any reference document that
  states it. An implementer works from the *plan*, a reader from the *design*, a user from the docs.
  Rewrite every **instruction** the answer touches, including a sibling PRD's reciprocal item. Keep the
  motivation in exactly one place: the `## Decisions` entry.
  - **A falsified premise is rewritten, not annotated.** No correction banner above superseded design.
    A banner is a second copy, and the next editor updates only one of them. A superseded *record*
    (what was walked, what was rejected) may stay, folded into the entry.
  - **Sweep what argues from the change, not only what states it.** A decision that removes a property
    can leave other sections whose *justification* leaned on it, even where their behaviour stays
    right. Grep for both, and rewrite the argument.
  - This is not cheap to skip. A review that records every answer correctly can still fail the merge
    gate on plan items, design sections and shipped docs that instruct the opposite of the decision
    above them. Each review round then fixes one layer. Fix all of them in the commit that makes the
    decision.
- **Edit mechanics:**
  - **Assert every scripted string replace** (for example `assert s.count(old) == 1`), and anchor on
    text that cannot wrap differently. A wrong anchor still builds, and every checker stays green.
  - **Diff what a scripted edit actually did** before you commit. `git diff --stat`. If the commit
    touches code but not the PRD, the PRD write was dropped.
  - **Run the `git mv` only after the edit is confirmed on disk.** An asserting edit `&&` the move,
    never a script that does both and can abort in the middle.
  - **Use the machine's date** (`date`), not the date you believe it is.
- **A re-resolved decision owes a sweep of every mention.** Its old answer is quoted outside its own
  entry: other decisions' "interacts with" lines, the plan preamble, section intros, a doc page. Grep
  the PRD *and* the rest of the repo for the decision's id and the old answer's key phrases. Rewrite
  every hit in the same commit. Then re-read the plan preamble.
- **Watch for drift arriving through a rebase.** Rebasing onto a PRD another session just corrected can
  leave a section far away contradicting one just above it. Each change was right; nobody read them
  together. After rebasing onto a PRD whose content moved, skim the sections your change does not
  touch.
- **One commit per decision.** Subject: `<PRD short name> D-<n> resolved: <the answer in a phrase>`. A
  walk that dies midway then loses nothing: the user's answers cannot be re-derived from the tree.

## Closing the walk (PRD)

- Last decision recorded: **ask the user to confirm the move.** Then, in one commit:
  - update the PRD's status note: all decisions resolved, what goes first;
  - say which test tier will cover the behaviour the decisions settled, and whether a new test is now a
    plan item;
  - `git mv` the PRD (and its companion files, same prefix) to `docs/prds/reviewed/`;
  - run `scripts/prd-index.py --write`. Never hand-edit inside its markers;
  - run `scripts/check-md-links.py` and fix links that pointed at the old path.
- **Stage explicit paths, then run the checks.** Never `git add -A`. CI checks the committed tree, so a
  link that resolves only through an unstaged file is green locally and red on CI.
- Push, note the folder move on the PR, say "walk CLOSED", and tell any peer waiting on the file. The
  next step is `/to-tickets`.

## Outside a PRD

The message shape is identical: what it decides, the verified facts, the options with their costs and
failure modes, the worked example, the impact, what it interacts with, then one `AskUserQuestion`. The
record goes **where the next reader of that decision will look**:

- the PR body, for a merge or review call;
- the test's own comment, for an assertion call (changing an assertion needs authority: a plan item in
  `reviewed/` or this decision, recorded);
- the GitHub issue, for a triage verdict (including one labelled `hospital`, or a `blocked/` PRD);
- a new intake, when the answer opens work.

Say in the record that it was the user's call, and when.

## What this is not

Not a place to re-litigate a decision the reviewer's findings did not touch. Not a batch: a decision
the user has not been asked is open, whatever the header says.
