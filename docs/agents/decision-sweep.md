# Decision sweep: owner, criteria, repo additions and calibration log

The `decision-sweep` skill (`.claude/skills/decision-sweep/SKILL.md`) reads this at the start of every
sweep.

## Owner

The owner of this sandbox, played by the course author. The owner reviews the sweep pull request and
answers the walk.

## After the sweep

walk_after: no    # yes: in an interactive session the sweep goes straight on to /decision-walk for the
                  # For-a-human items and any decided item the owner disagrees with. no: stop at the overview.

## Age pass

stale_days: 21   # `/decision-sweep stale` takes `ready-for-human` issues without `later` created longer ago than this
stale_rows: 40   # at most this many rows on one age sheet, oldest first

## Criteria

The skill's defaults, in order. Replace them here if this repo's owner judges differently.

1. Correct and to the point. No fluff, but solid.
2. Designed for growth: simple and understandable.
3. Designed for change: deep modules.

## Always for a human (this repo)

Added to the skill's own list. One line each, with why.

- Anything that changes when or whether a request is really sent to a broker: a sent request cannot
  be taken back, and the owner answers for it.
- Anything that reads the law differently from the PRD (deadlines, what counts as overdue or
  escalated): the tool is not legal advice, and the owner chose its reading.

## Calibration log

One line per sweep decision that failed: overturned by the owner, withdrawn or superseded (by a
builder's review, a verifier, a blind check, a later sweep). Newest on top. Every rule here counts
under checklist line 3. Failures in 30 days over decisions in 30 days (`## Sweep count`) above 5% with at least 3 failures, or
any failure that cost a release or a migration: the sweep's 95% gate is due for reconsideration. The
count starts once the oldest Sweep count row is 30 days old.

| Date | ID | Sweep chose (certainty) | Replaced by, found by | Review | Cost | Rule it teaches |
|---|---|---|---|---|---|---|

## Sweep count

One row per sweep, added in its sweep PR.

| Date | Sweep PR | Decided | For a human |
|---|---|---|---|
| 2026-11-27 | #59 | 3 | 3 |

## Blind checks

At most once per 30 days, 3 never-reviewed decisions re-decided by a fresh agent that sees only the
question, the options and the criteria.

| Date | IDs | Held | Policy or taste, same option | Failed |
|---|---|---|---|---|
