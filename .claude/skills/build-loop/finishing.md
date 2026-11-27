# Finishing a PR

Part of the `build-loop` skill (copy it next to its `SKILL.md`). Read it when `finish #<n>` names a PR,
or when a PR I adopted is open.

PRs no lane owns (design, docs, sweep and session PRs) go stale and conflict. A lane **finishes** one
the owner or the shepherd names. Giving up an adopted PR (step 2, 4, the Tripwire) is step 6 below.
Stopping is not giving up: the PR stays mine, Stopping writes only what is owed.

## The markers

Comments on the PR whose first line is one of these:

- `<!-- adopted lane=<lane> -->`: a lane took it over.
- `<!-- handed-back lane=<lane> -->`: that lane gave it up; the owner must move it.
- `<!-- superseded lane=<lane> -->`: that lane found it superseded; the shepherd proposes closing it.

**The adopter** is the lane of the first `adopted` marker after the newest `handed-back` or
`superseded` one. No such `adopted` marker: nobody holds it. This rule settles two lanes that adopt at
once: the first comment wins, the other lane drops the PR without a comment.

**Moved since a hand-back**: a commit on the PR newer than the newest `handed-back` or `superseded`
marker. (Not a comment: the agents may post as the owner's account.) The owner can also move it by
typing the `finish` command.

## Steps

1. **Adopt**, after these checks, each made just now (`gh pr view <n> --json
   state,headRefName,isDraft,author,labels,updatedAt,reviewRequests,reviews,commits` and the markers):
   - open; its head branch is not a builder branch (`<branch_prefix>`); a draft only when the owner
     typed the command that names it;
   - created by the account the loops push as (`gh api user --jq .login`) or by an account listed in
     `owner_accounts` (missing or empty: only the loops' own account): never a colleague's PR. No
     review requested from a colleague, and no colleague's review with changes requested still open
     (an account in `owner_accounts` is not a colleague);
   - not labelled `later`; newest marker not `handed-back` or `superseded`, unless it moved since or
     the owner typed the command;
   - nobody holds it, or the adopter's lane is **gone**: its heartbeat says `stopped`, or its `time` is
     more than 12 hours old, and the PR has no commit in those 12 hours (12 hours: the shepherd's
     `claim_stale_hours` default; the builder does not read the shepherd's settings). Take it over only
     while that lane's `adopted` is still the newest marker: a `handed-back` marker for that lane,
     "taken over: lane <x> silent since <time>", then mine, then read the markers again;
   - **wait, do not refuse**, when: a commit or an update in the last 2 hours (unless the owner typed
     the command); a live peer on it (`ListAgents`); a decider heartbeat `sweeping` that names it. Keep
     it in the wake prompt's `finish` list and try again next iteration. An exception the owner's
     command gave holds for that PR until it is adopted.

   A check fails (not a wait): one line under Needs the owner, "did not adopt #<n>: <reason>", and
   leave it. Else comment, first line `<!-- adopted lane=<lane> -->`, then "Finishing this PR."; read
   the markers again: not the adopter, drop it. Work in a worktree of mine, detached on its branch (it
   may be checked out elsewhere): `git worktree add --detach <worktree_root>/<repo>-finish-<n>-<lane>
   origin/<branch>` (the path exists: add `-2`; never remove a worktree I did not create). Push with
   `git push origin HEAD:refs/heads/<branch>`, never forced; refused because the branch moved: fetch,
   merge, push again.
2. **Bring it up to date.** Merge `origin/<default_branch>` into it and resolve each conflict by
   understanding both sides (`SKILL.md` section 5, collisions). Both sides decided the same question
   differently, or less than 98% sure of a resolution: `git merge --abort` and hand it back (step 6).
3. **Superseded?** Its change is already on the default branch, the ticket or decision it carries was
   closed or decided otherwise, or a later PR does the same: do not finish it. Comment, first line
   `<!-- superseded lane=<lane> -->`, with the evidence (a commit, a PR, or a file at a sha). Post no
   `handed-back` marker; remove my worktree. Only the owner's yes on the shepherd's proposal closes it.
4. **Build and review** as `SKILL.md` sections 3 and 4, from round 1 with the full diff: a review not
   recorded in the PR body in the form of step 4.4 does not count. Write the green record and the
   review record under `## Finished by lane <lane>` at the end of its body, keeping the author's text.
   A finding that needs a decision, or that changes what the PR is for: hand it back.
5. **Merge gate** as `SKILL.md` section 5; the claim item does not apply. Then the repo's merging
   policy decides for that kind of PR. Where it, or the PR itself, leaves the merge to the owner (a
   sweep PR, `docs/agents/unattended-protocol.md` "Sweep PRs", with decisions pending the owner's
   review; a PR that asks for the owner's review): mark it "READY TO MERGE at `<sha>`" and put it
   under Ready for the owner. It stays mine but does not count toward `max_open_prs`; I bring it up to
   date again only when it conflicts (DIRTY), not when it is only behind. A walk on it (decision-walk)
   may add commits: the decider merges it then ("Merging a walked sweep PR"). Otherwise merge it as
   section 5 says. Merged or READY TO MERGE: remove my worktree. The PR's branch is not mine to delete.
6. **Hand back**: comment, first line `<!-- handed-back lane=<lane> -->`, and why; one line under Needs
   the owner. Remove my worktree (changes in it: commit and push them first). It is no longer mine.

With `tracker: azure`: the markers are PR thread comments (`docs/agents/issue-tracker.md`); a command
the adapter does not list yet: do not adopt, one line under Needs the owner.
