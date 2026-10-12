#!/usr/bin/env python3
"""Check that relative markdown links in tracked .md files resolve.

    scripts/check-md-links.py            # exit 1 if any relative link is unresolved

Ignores http(s)/mailto links, pure anchors, and anything inside fenced code blocks or inline code.
Anchors after a path (`file.md#section`) are stripped; only the file is checked.
"""

import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INLINE = re.compile(r"\[[^\]\n]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
FENCE = re.compile(r"^\s*(```|~~~)")
CODE_SPAN = re.compile(r"`[^`\n]*`")


def tracked_markdown():
    out = subprocess.run(
        ["git", "ls-files", "*.md"], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout
    return [p for p in out.splitlines() if os.path.exists(os.path.join(ROOT, p))]


def unresolved(rel):
    bad = []
    in_fence = False
    base = os.path.dirname(os.path.join(ROOT, rel))
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            if FENCE.match(line):
                in_fence = not in_fence
                continue
            if in_fence:
                continue
            for m in INLINE.finditer(CODE_SPAN.sub("", line)):
                target = m.group(1).split("#", 1)[0]
                if not target or re.match(r"^[a-z][a-z0-9+.-]*:", target):
                    continue
                if target.startswith("/"):
                    path = os.path.join(ROOT, target.lstrip("/"))
                else:
                    path = os.path.normpath(os.path.join(base, target))
                if not os.path.exists(path):
                    bad.append((n, m.group(1)))
    return bad


def main():
    total = 0
    for rel in tracked_markdown():
        for n, target in unresolved(rel):
            print(f"{rel}:{n}: unresolved link {target}")
            total += 1
    print(f"{total} unresolved reference(s).")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
