# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the "Label in our tracker" column to match whatever vocabulary you actually use.

## Labels we add

| Label | Meaning |
|---|---|
| `blocked` | Waiting on something outside the ticket graph (a ticket waiting on a ticket gets a native blocking edge instead) |
| `deferred` | Parked by choice |
| `hospital` | A failing test an agent could not resolve. The test stays in the suite; the issue holds the evidence and a resume plan. There is no `hospital/` folder |

## Scope: a milestone, or `later`

<!-- Append this section to the repo's docs/agents/triage-labels.md, which /triage reads.
     Create the label once: gh label create later --color C5DEF5 --description "Parked: outside the current milestones; triage may promote it" -->

### First: is it a ticket at all? (the scope gate)

Before a finding becomes a ticket, on every path that files one (a review follow-up, a reviewer's
finding outside the range, a close-out, a docs or lab pass), ask one question:

> Can a user hit this in supported use?

The repo's `## Scope` section (in its canonical instruction file) says who the user is and what is
supported, and lists the non-goals. No `## Scope` yet: judge by the README's public surface, and
file when unsure. **Hit** means a user sees it: a wrong result, an error, a crash,
lost data, a hang, a measurable slowdown on a supported workload, a documented feature that does not
work, or docs that say something false.

- **Yes:** file it, with one line saying how a user hits it, and give it a scope (below).
- **No:** file nothing. Record it where it was found, as `not filed: <why no user hits it>`, citing a
  non-goal where one applies (in a PR: its findings table). That record is searchable.
- **Always filed, whatever the answer:** security (a user or input can do what it should not); lost
  or corrupted data; a wrong result a user could take as right; the build, the tests or CI broken or
  flaky on the default branch.

Not tickets, for example: tidying or renaming in code no user reaches, test hygiene, a performance
idea without a workload that shows it, a cleanup "while we are here", an input the public surface
rejects, a reviewer's preference. A ticket the owner asks for by name is filed without the gate. A
ticket the owner or a user files themselves goes through triage as usual; when it fails the gate,
triage recommends closing it with the reason.

### Then: its scope

Besides its category and its one state label, every triaged ticket gets **one scope**:

- **a milestone**: the release it is strictly necessary for (the repo's open milestones on GitHub); or
- **`later`**: it side-tracks. Useful, but not strictly necessary for any open milestone.

**Milestone order** ("earliest", wherever a skill says it): by due date; a milestone without a due date
comes after those with one, by its version number. Ties, and undated titles that are not versions, go
by title.

`later` is not a state role: it sits next to the state label, which stays as it is. Promoting a ticket
is one edit: remove `later`, set the milestone, say why in a triage comment. The build loop does not
pick a ticket labelled `later`.

**Strictly necessary for a release** means at least one of:

- a customer of that release would hit it: wrong results, lost data, a crash, a documented feature that
  does not work;
- it settles an item of the supported contract, which cannot change after the release without a major;
- the release itself needs it: packaging, versioning, the help that ships with it;
- a ticket already in the milestone is blocked by it.

Anything else is `later`. Typical: a review finding that holds but does not threaten the release, a
performance idea without a problem a customer sees, tidying, test hygiene, a nice-to-have, new scope
that no milestone plans (a new domain, a new surface).

How `/triage` applies it:

- **Recommend** (step 2): give the scope with the category and state, with the bullet above that makes
  it necessary, or "side-tracks: <why>" for `later`. Wait for direction as usual.
- **Apply** (step 5): set the milestone or the label together with the state. Apply a quick state
  override ("#42 is later") directly.
- **In doubt**: `later`, with the doubt in one line. The owner promotes; a wrong `later` costs one edit,
  a wrong milestone costs the release.
- **Show what needs attention**: add a fourth bucket, **unscoped**: open tickets with neither a
  milestone nor `later`, oldest first.

Every other path that files or relabels a ticket sets the scope **in the same edit**, so no ticket
reaches the queue unscoped. Two exceptions: a routed question that nothing scoped waits on (below), and a
ticket routed in its own form (`docs/agents/unattended-protocol.md`), which keeps its scope as it is,
also none, because routing never decides a scope.

- **`/to-tickets`**: each published ticket gets the milestone its plan, PRD or openspec change is for.
  When the plan names none, ask the owner once, for the whole set, before publishing.
- **A ticket filed during other work** (a review follow-up, a finding from a docs or lab pass, a new
  issue opened by a decision), once it passed the gate: `later` by default, and the ticket says "side-tracks: <why>". It gets a
  milestone only when a bullet above makes it necessary; the ticket then names that bullet.
- **A routed question** (`Decision needed:`, `docs/agents/unattended-protocol.md`) takes the scope of
  what waits on it: a ticket's scope, the milestone a PRD or plan is for, the scope of the ticket a PR
  closes. Several: the earliest milestone among them. `later` only when everything that waits is
  `later`. When nothing that waits has a scope, the question stays unscoped and its body says so: it
  shows in the **unscoped** bucket, and a sweep still takes it. A sweep leaves a `later` question out
  unless it is named.
- **A promotion** (remove `later`, set a milestone) also moves every open `Decision needed:` issue the
  ticket waits on to the ticket's milestone, unless the question already has an earlier one.
- **A relabel** (a sweep's step 6, a quick override): the ticket keeps the scope it has. A ticket
  without one gets it in the same edit.
- **A parking label the repo keeps besides the five roles** (such as `deferred`): add `later` with it,
  so that the **unscoped** bucket lists only what nobody has scoped yet.
