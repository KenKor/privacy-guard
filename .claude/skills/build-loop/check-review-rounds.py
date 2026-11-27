#!/usr/bin/env python3
"""Check a PR's review record against the round caps of build-loop step 4.7.

    check-review-rounds.py --pr <n> [-R owner/repo]   # reads the body with gh
    check-review-rounds.py --body-file <path>          # e.g. an Azure DevOps PR description
    check-review-rounds.py --selftest

Exit 1, with what to do instead, when the record:
- has no `Regime: prose` or `Regime: code` line, or no `### Round 1, at <sha7>` heading;
- has more counted rounds since the last scope restart than the regime allows (prose 2, code 3),
  unless an `Owner order: up to <m> rounds (...)` line allows more;
- has more than 2 rebase rounds, or more than one nit-fix pass since the last scope restart.

Only the text after the last `## Finished by lane` heading counts: an adopted PR starts at round 1
(`finishing.md`). The check counts headings; it does not judge whether a round was needed.
"""

import argparse
import re
import subprocess
import sys

CAPS = {"prose": 2, "code": 3}
REBASE_CAP = 2

REGIME = re.compile(r"^\W*Regime:\W*(prose|code)\b", re.M | re.I)
ROUND = re.compile(r"^#{2,4} Round (\d+)(?: after (.+?))?, at ", re.M)
REBASE = re.compile(r"^#{2,4} Rebase round (\d+), at ", re.M)
NITPASS = re.compile(r"^#{2,4} Nit-fix pass(?: after (.+?))?, at ", re.M)
ORDER = re.compile(r"^\W*Owner order:\W*up to (\d+) rounds\b", re.M | re.I)


def problems_in(body):
    parts = re.split(r"^## Finished by lane\b.*$", body, flags=re.M)
    record = parts[-1]
    problems = []
    regime = REGIME.findall(record)
    if not regime:
        problems.append("no `Regime: prose` or `Regime: code` line in the review record (build-loop step 4.7)")
    rounds = [(int(n), after or "") for n, after in ROUND.findall(record)]
    if not rounds:
        problems.append("no `### Round 1, at <sha7>` heading: record each round as build-loop step 4.7 says")
        return problems
    restart = rounds[-1][1]
    counted = sorted({n for n, after in rounds if after == restart})
    orders = [int(m) for m in ORDER.findall(record)]
    cap = max([CAPS[regime[-1].lower()] if regime else CAPS["code"]] + orders)
    if len(counted) > cap:
        since = f" after {restart}" if restart else ""
        problems.append(
            f"{len(counted)} counted rounds{since}, cap {cap}: stop and hand back (build-loop step 6) "
            "with one line under Needs the owner; more rounds need an `Owner order: up to <m> rounds` line")
    if counted != list(range(1, len(counted) + 1)):
        problems.append(f"round numbers {counted} do not run 1, 2, 3: number each counted round once")
    rebases = len(REBASE.findall(record))
    if rebases > REBASE_CAP:
        problems.append(f"{rebases} rebase rounds, at most {REBASE_CAP} per PR: the next one goes to Needs the owner")
    passes = [after or "" for after in NITPASS.findall(record)]
    if passes.count(restart) > 1:
        problems.append("more than one nit-fix pass: a nit it raises is recorded as \"left\", not fixed in another pass")
    return problems


def selftest():
    ok = "Regime: code\n### Round 1, at abc1234\n### Round 2, at def5678\n### Nit-fix pass, at 0123456\n"
    cases = [
        (ok, 0),
        ("### Round 1, at a\n", 1),                                           # no regime
        ("Regime: prose\nno headings\n", 1),                                  # no rounds
        ("Regime: prose\n### Round 1, at a\n### Round 2, at b\n### Round 3, at c\n", 1),
        ("Regime: code\n" + "".join(f"### Round {i}, at x\n" for i in (1, 2, 3, 4)), 1),
        ("Regime: code\nOwner order: up to 5 rounds (the owner, 2026-11-22, #1)\n"
         + "".join(f"### Round {i}, at x\n" for i in (1, 2, 3, 4)), 0),
        ("Regime: code\n### Round 1, at a\n### Round 2, at b\n### Round 3, at c\n"
         "### Round 1 after scope change by the owner, at d\n### Round 2 after scope change by the owner, at e\n", 0),
        ("Regime: code\n### Round 1, at a\n### Round 3, at b\n", 1),          # gap
        ("Regime: code\n### Round 1, at a\n" + "### Rebase round 1, at b\n" * 3, 1),
        ("Regime: code\n### Round 1, at a\n### Nit-fix pass, at b\n### Nit-fix pass, at c\n", 1),
        ("Regime: code\n" + "".join(f"### Round {i}, at x\n" for i in range(1, 22))
         + "## Finished by lane 0\nRegime: prose\n### Round 1, at y\n", 0),
        ("**Regime:** prose\n#### Round 1, at a\n#### Round 2, at b\n", 0),
    ]
    failed = [i for i, (body, want) in enumerate(cases) if bool(problems_in(body)) != bool(want)]
    for i in failed:
        print(f"selftest case {i} failed: {problems_in(cases[i][0])}")
    print(f"selftest: {len(cases) - len(failed)}/{len(cases)} passed")
    return 1 if failed else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--pr")
    ap.add_argument("-R", "--repo")
    ap.add_argument("--body-file")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    if a.body_file:
        with open(a.body_file, encoding="utf-8") as f:
            body = f.read()
    elif a.pr:
        cmd = ["gh", "pr", "view", a.pr, "--json", "body", "-q", ".body"] + (["-R", a.repo] if a.repo else [])
        body = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout
    else:
        ap.error("give --pr, --body-file or --selftest")
    problems = problems_in(body)
    for p in problems:
        print(p)
    print(f"review rounds: {len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
