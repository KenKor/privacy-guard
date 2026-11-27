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

Besides its category and its one state label, every triaged ticket gets **one scope**:

- **a milestone**: the release it is needed for (the repo's open milestones on GitHub); or
- **`later`**: it side-tracks. Useful, but not strictly necessary for the next release.

`later` is not a state role. It sits next to the state label, which stays as it is, so promoting a
ticket is one edit: remove `later`, set the milestone, and say why in a triage comment. The build loop
does not pick a ticket labelled `later`.

**Strictly necessary for the next release** means at least one of:

- a customer of that release would hit it: wrong results, lost data, a crash, a documented feature that
  does not work;
- it settles an item of the supported contract, which cannot change after the release without a major;
- the release itself needs it: packaging, versioning, the help that ships with it;
- a ticket already in the milestone is blocked by it.

Anything else is `later`. Typical cases: a review finding that holds but does not threaten the release,
a performance idea without a problem a customer sees, tidying, test hygiene, a nice-to-have, new scope
that no milestone plans (a new domain, a new surface).

How `/triage` applies it:

- **Recommend** (step 2): give the scope with the category and state, with the bullet above that makes
  it necessary, or "side-tracks: <why>" for `later`. Wait for direction as usual.
- **Apply** (step 5): set the milestone or the label together with the state. A quick state override
  ("#42 is later") is applied directly.
- **In doubt**: `later`, with the doubt in one line. The owner promotes; a wrong `later` costs one edit,
  a wrong milestone costs the release.
- **Show what needs attention**: add a fourth bucket, **unscoped**: open tickets with neither a milestone
  nor `later`, oldest first.
- A ticket filed during other work (a review follow-up, a finding from a docs or lab pass) gets its scope
  when it is filed. Its default is `later`.
