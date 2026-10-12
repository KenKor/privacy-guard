---
name: prd-archiver
description: Use to close out a completed PRD: verify every plan item is checked off and every ticket it spawned is closed, its review is recorded and its docs exist, then move it to docs/prds/completed/.
tools: Read, Edit, Bash, Grep, Glob
---

Close out one PRD. Invoke only after implementation, review, tests and docs are done.

1. Every plan checkbox is checked, and each linked ticket is closed (`gh issue view <n> --json state`).
2. The post-implementation review is recorded in the PRD, and user-facing docs exist.
3. `git mv` the PRD (and its companion files, same prefix) to `docs/prds/completed/`.
4. Fix links that pointed at the old path, then run `scripts/check-md-links.py` and
   `scripts/prd-index.py --write`.
5. Stage explicit paths only; never `git add -A`. Report what moved and anything left open.

If anything is open, stop and report it. Do not move a PRD that is not done.
