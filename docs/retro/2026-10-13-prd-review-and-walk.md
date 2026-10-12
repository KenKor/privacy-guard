# Retro: PRD review and decision walk for opt-out-broker-a

Session: the `prd-reviewer` rounds and decision walk on `docs/prds/designed/opt-out-broker-a.md`
(branch `prd/opt-out-broker-a`, PR #6), 2026-10-12. Log:
the session log of 2026-10-12 (session `ca113933`, on the course author's machine).
Files checked against the repo at `cf3aab7`. Candidates only; none is implemented. Ordered by severity.

## 1. The reviewer passed a false premise (D-2)

**Category:** coding standards (reviewer rule).

**Evidence:** Round 1 said "None of the PRD's claims turned out false" and READY FOR WALK. It called the
quote of `sites/broker-a/index.html:32` accurate, but in context that line contradicts D-2 (broker A
takes email). The user's follow-up question turned the verdict around. Round 2 found far more because
the main agent wrote an adversarial prompt; `.claude/agents/prd-reviewer.md` does not carry those checks.

**Fix:** In `prd-reviewer.md` check 1, check the premises of resolved decisions too. Tag each premise
by source (repo bytes, measurement, the user's word). A premise that rests on the user's word and is
contradicted by the repo is blocking. Read every quote together with the lines around it. In
`prd-author.md`, record a fact the user states about the outside world as unverified until the repo
confirms it.

## 2. Decisions marked "RESOLVED with the user" that the user had not decided

**Category:** information access, automated checks.

**Evidence:** The web-form rewrite stamped D-4, D-7, D-9 and D-13 as resolved with the user (round 2,
B1). The reviewer cannot see the session, so it was partly wrong as well: D-4 and D-13 had been decided
in the conversation. The skill's record line (`RESOLVED <date> with the user: option (x)…`) cannot be
checked.

**Fix:** Every RESOLVED entry carries a provenance line: the user's words quoted verbatim, plus where
they were said (session date, issue comment, commit). Whether the field is present is mechanical, so
`scripts/prd-index.py` (check mode exits 1) can fail on a RESOLVED entry that lacks it.

## 3. No guardrail, and the skill claims CI

**Category:** automated checks.

**Evidence:** `package.json` has `lint` (`tsc --noEmit`) and `test`; `scripts/prd-index.py` has a check
mode; `scripts/check-md-links.py` exists. Nothing runs them: there is no `.github/` and no pre-commit
hook. The agent ran the scripts by hand before every commit, and once found out the index was stale only
from the script's output. `decision-walk/SKILL.md` says "CI checks the committed tree".

**Fix:** Run all four commands in a pre-commit hook and in a CI workflow.

## 4. The send guard blocks commands that only mention a send

**Category:** tool economy.

**Evidence:** In the session, a heredoc that wrote a Python edit script was blocked because the
script's text contained the send command. The same thing happened again during this retro. The deny
message ("run it in dry-run, show the user…") does not fit a command that sends nothing. The agent
recovered by writing the script with Write and running the file, at the cost of a turn.

**Fix:** Keep the pattern strict. Add to `deny()` in `.claude/hooks/deny-outward-send.sh`: "If the
command only contains this text (a heredoc or script body), write it with the Write tool and run the
file."

## 5. Context pressure forced a compaction mid-walk

**Category:** tool economy, navigation.

**Evidence:** The agent ran `cat -n` on the whole PRD (36 KB). It used `ls -R` plus `cat` on all source
in a single call (33 KB). The three reviewer reports were 8-10 KB each. Dozens of `grep -n` then
`sed -n` pairs went to finding entries in a PRD of about 1,000 lines. Context was compacted between the
third review and the presentation of D-1.

**Fix:** Add a section reader (in `scripts/prd-index.py` or a sibling script) that prints one entry,
such as `D-14` or `## Commands`, by its heading. As a separate decision: whether a PRD this size should
move its decision entries into a companion file.

## 6. Stale or impossible instructions

**Category:** no-ops.

**Evidence:**
- `decision-walk/SKILL.md` asks for the reviewer to run "against a worktree at fresh `origin/main`".
  The PRD under review lives on its branch, and the session ignored this.
- The skill requires `AskUserQuestion`, which was unavailable. The session asked in prose instead.
- `prd-author.md` names files `<Name>-prd.md`, but the repo uses `opt-out-broker-a.md`. Round 2 noted
  this as a nit.

**Fix:** Rewrite each line to match what is actually done.

## 7. A bad measurement got into the PRD

**Category:** coding standards (skill rule).

**Evidence:** The D-14 probe tested a refused connection against port 1, which `fetch` blocks as
"bad port". The PRD then said a refused connection "carried no code". Round 3 measured again and
caught it.

**Fix:** In the skill's bullet on external behaviour: a recorded measurement states its setup (Node
version, host and port, the exact call), so a reviewer can rerun it.

## 8. WebSearch was not permitted

**Category:** information access.

**Evidence:** The D-1 claim that supervisory authorities take complaints by web form stayed unverified
because WebSearch was denied. WebFetch was allowed.

**Fix:** Allow WebSearch for this project, if the owner wants it.
