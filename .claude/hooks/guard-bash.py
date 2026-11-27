#!/usr/bin/env python3
"""guard-bash.py: Claude Code PreToolUse hook on Bash for the build loop and the reviewers.

Copy to `.claude/hooks/guard-bash.py`. Named in the frontmatter of the `build-loop` skill (mode
`builder`) and of the reviewer agents (mode `reviewer`), so it runs only in a session that invoked
the skill, or while a reviewer is active. Mode `rg` is the exception: it is named in the user
settings and runs in every session.

  builder   no force-push, no `gh pr merge --admin`, no staging of everything (`git add -A`, `.`,
            `-u`, `git commit -a`): build-loop, "Never" and "stage explicit paths". Azure DevOps
            (`tracker: azure`): no `--bypass-policy` and no `"bypassPolicy": true` (also in the JSON
            file an `az` call names with `--in-file` or `--body @`), no `--auto-complete` (or an
            abbreviation of it) and no `az repos pr update --status completed`: both complete
            whatever head is current, not the head the gate checked. In all three modes: no `rg -r` in
            a short option (`rg -rn`): it is `--replace`, not recursive, and rewrites every match
            in the output you read as evidence (rg is recursive by default; `--replace` stays allowed)
  rg        only the `rg -r` rule: for the owner's user settings, so ordinary sessions get it too
            (a copy in the user's hooks folder, named in the user settings; see the templates README)
  reviewer  the builder rules, plus no git command that changes the tree, the index, a branch or
            the remote, no `gh` command that writes, and no `az` command that writes: `az repos`,
            `az boards`, `az pipelines`, `az devops` and extension writes, an `az devops invoke` or
            `az rest` other than GET, and sign-in or configuration changes (AZ_SIGN_IN). A
            reviewer reads the worktree it is given and reports; it makes no worktree of its own.

A tripwire for the ordinary slip, not a wall: a command inside a script file or `bash -c '...'`
gets past it. Quoted text, heredoc bodies and comments are not checked, so a commit message or a
PR body may name a denied command. Still checked: a quoted single word (`"."`, `"--force"`), a
`$(...)` inside double quotes, and a heredoc fed to `bash`, `sh` or `zsh` (not one piped to a
shell). The price: a quoted one-word value that looks like a flag (`-m "-a"`) is refused, and
`bypassPolicy: true` anywhere in a command that also runs `az` is refused, even in quoted text.

Contract: JSON on stdin with tool_name and tool_input.command. Exit 0 allows. Exit 2 denies;
stderr is shown to the model as the reason. Any other failure lets the call through.

Usage: guard-bash.py builder|reviewer|rg  (as a hook, reads JSON on stdin)
       guard-bash.py --selftest           (runs the allow and deny cases below)
"""

import json
import os
import re
import sys

END = r"(?![\w-])"
ARG = r"(?!-|\d*[<>])[^\s;&|)]"          # first character of an argument: no option, no redirect
PREFIX = (r"(?:(?:then|do|else|elif|!|time|exec|command)\s+|[A-Za-z_]\w*=\S*\s+)*"
          r"(?:(?:sudo|env|xargs|timeout|nice)[ \t]+"      # wrappers, each with its own options
          r"(?:(?:-[^\s;&|()]+(?:[ \t]+(?![-\d]|(?:sudo|env|xargs|timeout|nice)[ \t])[^\s;&|()=]+)??"
          r"|\d[^\s;&|()]*|[A-Za-z_]\w*=[^\s;&|()]*)[ \t]+)*)*")
START = r"(?:^|[;&|(){`\n])\s*" + PREFIX
GIT = START + (r"(?:\S*/)?git(?:\s+(?:-[Cc]\s+\S+|--(?:git-dir|work-tree|namespace)(?:=|\s+)\S+"
               r"|--[a-z-]+(?:=\S+)?|-[a-zA-Z]))*\s+")
REPO = r"(?:(?:-R|--repo)(?:=|\s+)\S+\s+)*"
GH = START + r"(?:\S*/)?gh\s+" + REPO
REST = r"([^;&|\n]*)"       # the rest of that one command
RG = START + r"(?:\S*/)?rg" + END + REST
# A short option cluster that holds -r (`-r`, `-rn`, `-nr`, `-Sr`): -r is --replace. The letters before it
# must be flags without a value: after -t, -g, -e and the like the rest is a value (`-tr`, `-gsrc/**`).
RG_REPLACE = r"(?:^|\s)-[^\W\d_ABCEMTdefgjmt]*r"
RG_SKIP = r"\$\([^()]*\)|`[^`]*`|'[^']*'|\"[^\"]*\""   # substitutions and quoted text are not rg's options

GIT_WRITES = "|".join([w + END for w in [
    "commit", "push", "rm", "mv", "reset", "rebase", "merge", "cherry-pick", "revert", "checkout",
    "switch", "restore", "am", "pull", "stage", "bisect", "gc", "prune", "filter-branch", "replace",
    "update-ref", "update-index",
]] + [
    r"add" + END + r"(?!\s+(?:-n|--dry-run)\b)",
    r"stash" + END + r"(?!\s+(?:list|show)\b)",
    r"apply" + END + r"(?!\s+--(?:check|stat|numstat|summary)\b)",
    r"clean" + END + r"(?!\s+(?:-[\w-]+\s+)*(?:-[a-zA-Z]*n|--dry-run))",
    r"tag[ \t]+(?:-[dasfmu]\b|--(?:delete|annotate|sign|force)\b|" + ARG + r")",
    r"worktree\s+(?:add|remove|move|prune|repair|lock|unlock)",
    r"branch[ \t]+(?:(?:-\S+[ \t]+)*(?:-[a-zA-Z]*[dDmMcCfu]\b"
    r"|--(?:delete|move|copy|force|set-upstream-to|unset-upstream|edit-description)\b)|" + ARG + r")",
    r"remote\s+(?:add|remove|rm|rename|set-url|set-head|set-branches|prune|update)",
    r"notes\s+(?:add|append|remove|edit|copy|merge|prune)",
    r"submodule\s+(?:update|add|init|deinit|sync|set-url|set-branch|absorbgitdirs|foreach)",
    r"sparse-checkout\s+(?:set|add|init|disable|reapply)",
    r"reflog\s+(?:expire|delete)",
    r"symbolic-ref[ \t]+[^-\s]\S*[ \t]+" + ARG,
    r"config\s+(?:set|unset|edit|rename-section|remove-section)\b",
    r"config\s+(?:\S+\s+)*?(?:--unset\S*|--add|--replace-all|--edit|-e|--rename-section|--remove-section)\b",
    r"config\s+(?:--(?:global|local|system|worktree)\s+)*[\w-]+\.[\w.-]+[ \t]+" + ARG,
])
GH_WRITES = "|".join([
    r"pr\s+" + REPO + r"(?:merge|close|edit|comment|review|ready|create|reopen|lock|unlock|checkout|update-branch)",
    r"issue\s+" + REPO + r"(?:create|edit|close|comment|reopen|delete|transfer|pin|unpin|lock|unlock|develop)",
    r"label\s+(?:create|edit|delete|clone)", r"release\s+(?:create|edit|delete|upload)",
    r"repo\s+(?:create|edit|delete|rename|archive|fork|sync)",
    r"workflow\s+(?:run|enable|disable)", r"run\s+(?:rerun|cancel|delete)",
    r"secret\s+(?:set|delete|remove)", r"variable\s+(?:set|delete)", r"cache\s+delete",
    r"gist\s+(?:create|edit|delete|rename|clone)",
    r"project\s+(?!list\b|view\b|field-list\b|item-list\b)\w",
    r"auth\s+(?:login|logout|switch|refresh|setup-git)",
])
FORCE = r"(?:^|\s)(?:--force|--mirror|-[a-zA-Z]*f[a-zA-Z]*(?![\w-])|\+\S)"
STAGE_ALL = r"(?:^|\s)(?:--all\b|--update\b|-[a-zA-Z]*[Au][a-zA-Z]*\b|\.{1,2}/?(?=\s|$)|:/(?=\s|$)|\*(?=\s|$))"
COMMIT_ALL = r"(?:^|\s)(?:--all\b|(?!-u(?:all|normal)\b)-[a-zA-Z]*a[a-zA-Z]*\b)"
METHOD = r"(?:^|\s)(?:-X|--method)[\s=]*([A-Za-z]+)"
FIELDS = r"(?:^|\s)(?:-f|-F|--field|--raw-field|--input)\b"
AZ = START + r"(?:\S*/)?(?i:az(?:\.cmd|\.exe)?)\s+"
AZ_GROUPS = ("repos", "boards", "pipelines", "devops", "extension")
# A set of verbs, not a regex list like GH_WRITES: az nests subgroups (`repos pr reviewer add`), so
# the verb can be the third or fourth word.
AZ_WRITE_WORDS = {"create", "update", "delete", "set-vote", "checkout", "add", "remove", "queue",
                  "lock", "unlock", "run", "cancel", "import", "rename", "set", "install",
                  "uninstall", "enable", "disable", "upload"}
AZ_SIGN_IN = (["login"], ["logout"], ["configure"], ["config", "set"], ["config", "unset"],
              ["account", "set"], ["account", "clear"], ["devops", "login"], ["devops", "logout"],
              ["devops", "configure"])
NO = r"(?i:false|no|off|0)\b"
BYPASS_JSON = r"[\"']?bypassPolicy[\"']?\s*:\s*[\"']?true\b"
AZ_METHOD = r"(?:^|\s)(?:--http-method|--method|-m)(?:=|\s+)['\"]?([A-Za-z]+)"
AZ_BODY = r"(?:^|\s)(?:--in-file|--body|-b)\b"
AZ_FILE = r"(?:^|\s)(?:--in-file(?:=|\s+)|(?:--body|-b)(?:=|\s+)@)(\S+)"


HEREDOC = r"(<<-?\s*(['\"]?)(\w+)\2[^\n]*\n)(.*?\n)[ \t]*\3\b"
SHELL = r"(?:^|[\s;&|(/])(?:bash|sh|zsh)(?:\s+-\S+)*\s*$"
WORD = r"[\w@%+=:,./*~^-]+"


def heredoc(m):
    """The opener line; the body too when the heredoc is fed to a shell."""
    before = m.string[:m.start()].rsplit("\n", 1)[-1]
    return m.group(1) + (m.group(4) if re.search(SHELL, before) else "")


def word(text):
    """A quoted single word stays (as a flag or a path it counts); other quoted text goes."""
    return text if re.fullmatch(WORD, text) else "''"


def unquote(command):
    out, i, n = [], 0, len(command)
    while i < n:
        c = command[i]
        if c == "\\":
            out.append(command[i:i + 2])
            i += 2
        elif c == "'":
            j = command.find("'", i + 1)
            j = n if j < 0 else j
            out.append(word(command[i + 1:j]))
            i = j + 1
        elif c == '"':
            text, subs = [], []
            i += 1
            while i < n and command[i] != '"':
                if command[i] == "\\":
                    text.append(command[i:i + 2])
                    i += 2
                elif command.startswith("$(", i):
                    j, depth = i + 2, 1
                    while j < n and depth:
                        depth += {"(": 1, ")": -1}.get(command[j], 0)
                        j += 1
                    subs.append("$(" + unquote(command[i + 2:j - 1 if not depth else j]) + ")")
                    i = j
                else:
                    text.append(command[i])
                    i += 1
            i += 1
            out.append('"' + " ".join(subs) + '"' if subs else word("".join(text)))
        elif c == "#" and (not out or out[-1][-1:].isspace()):
            while i < n and command[i] != "\n":
                i += 1
        else:
            out.append(c)
            i += 1
    return "".join(out)


def strip(command):
    """The command without what is only text: line continuations joined; heredoc bodies, quoted
    text of more than one word and comments removed."""
    command = command.replace("\\\n", " ")
    return unquote(re.sub(HEREDOC, heredoc, command, flags=re.S))


def flag_values(name, args):
    """The values given to `--<name>` or to an abbreviation of it, which az's parser accepts. Prefixes
    of 1 or 2 characters are not checked: a tripwire, not a boundary."""
    return [m.group(2).strip("'\"") for m in re.finditer(r"(?:^|\s)--([\w-]+)(?=(?:=|\s+)?(\S*))", args)
            if len(m.group(1)) >= 3 and name.startswith(m.group(1))]


def on_flag(name, args):
    """`--<name>` (or an abbreviation of it) set to anything but false."""
    return any(not re.fullmatch(NO, value) for value in flag_values(name, args))


def writes(args, method_re, body_re):
    """A REST call that writes: a method other than GET, or with no method, a body."""
    method = re.search(method_re, args)
    return method.group(1).upper() != "GET" if method else re.search(body_re, args) is not None


def az_words(args):
    """The group and verb words of an az command, up to its first flag."""
    words = []
    for token in args.split():
        if token.startswith("-"):
            break
        words.append(token)
    return words


def file_text(path, cwd):
    """The start of a JSON file an az call sends, or "" when it cannot be read."""
    try:
        full = os.path.join(cwd or ".", os.path.expanduser(os.path.expandvars(path.strip("'\""))))
        if not os.path.isfile(full):  # a FIFO or a device would block the hook
            return ""
        with open(full, encoding="utf-8", errors="replace") as f:
            return f.read(65536)
    except (OSError, ValueError):
        return ""


def rg_reason(command):
    """The reason an `rg -r` in this (stripped) command is denied, or None."""
    for m in re.finditer(RG, command):
        if re.search(RG_REPLACE, re.sub(RG_SKIP, " ", m.group(1)).split(" -- ")[0]):
            return ("`rg -r` (-r is --replace and rewrites the matches you quote; rg is recursive by "
                    "default: use `rg -n <pattern> <path>`)")
    return None


def check(raw, mode, cwd=None):
    """The reason this command is denied in this mode, or None."""
    command = strip(raw)
    if mode == G:
        return rg_reason(command)
    for m in re.finditer(GIT + "push" + END + REST, command):
        if re.search(FORCE, m.group(1)):
            return "force-push (never force-push: push new commits, or leave it to the owner)"
    for m in re.finditer(GH + r"pr\s+" + REPO + "merge" + END + REST, command):
        if re.search(r"(?:^|\s)--admin\b", m.group(1)):
            return "`gh pr merge --admin` (never bypass branch protection)"
    for m in re.finditer(GIT + "(?:add|stage)" + END + REST, command):
        if re.search(STAGE_ALL, m.group(1)) and not re.search(r"(?:^|\s)(?:-n|--dry-run)\b", m.group(1)):
            return "`git add` of everything (stage explicit paths only)"
    for m in re.finditer(GIT + "commit" + END + REST, command):
        if re.search(COMMIT_ALL, m.group(1)):
            return "`git commit -a` (stage explicit paths, then commit)"
    reason = rg_reason(command)
    if reason:
        return reason
    az_calls = [m.group(1) for m in re.finditer(AZ + REST, command)] if "az" in command.lower() else []
    for args in az_calls:
        if on_flag("bypass-policy", args):
            return "`az ... --bypass-policy` (never bypass branch policies)"
        if on_flag("auto-complete", args):
            return "`az repos pr --auto-complete` (merge only the head the gate checked, by `merge_command`)"
        if az_words(args)[:3] == ["repos", "pr", "update"] and any(
                value.lower() == "completed" for value in flag_values("status", args)):
            return "`az repos pr update --status completed` (merge only by `merge_command`, on the gated head)"
    if az_calls:
        if re.search(BYPASS_JSON, raw, re.I):
            return "`bypassPolicy: true` in an `az` call (never bypass branch policies)"
        # The raw command: strip() blanks a quoted path such as "$TMPDIR/merge-<n>.json".
        for path in set(re.findall(AZ_FILE, raw)):
            if re.search(BYPASS_JSON, file_text(path, cwd), re.I):
                return f"`bypassPolicy: true` in {path} (never bypass branch policies)"
    if mode != "reviewer":
        return None
    for args in az_calls:
        words = az_words(args)
        if any(words[:len(w)] == w for w in AZ_SIGN_IN):
            flags = set(re.findall(r"(?:^|\s)(-[\w-]+)", args))
            # `--list` with `--defaults` still writes; only output flags may come with it
            if flags & {"-l", "--list"} and flags <= {"-l", "--list", "-o", "--output", "--query"}:
                continue
            return f"`az {' '.join(words[:2])}` (a reviewer does not change the sign-in or the configuration)"
        if words[:1] and words[0] in AZ_GROUPS and AZ_WRITE_WORDS & set(words[1:5]):
            return f"`az {' '.join(words[:4])}` (a reviewer is read-only: put it in your report)"
        if (words[:2] == ["devops", "invoke"] or words[:1] == ["rest"]) and writes(args, AZ_METHOD, AZ_BODY):
            return f"`az {' '.join(words[:2])}` that writes (a reviewer is read-only)"
    m = re.search(GIT + r"(" + GIT_WRITES + r")", command)
    if m:
        return f"`git {' '.join(m.group(1).split()[:2])}` (a reviewer is read-only: report it as a finding)"
    m = re.search(GH + r"(" + GH_WRITES + r")", command)
    if m:
        return f"`gh {' '.join(m.group(1).split()[:2])}` (a reviewer is read-only: put it in your report)"
    for m in re.finditer(GH + "api" + END + REST, command):
        args = m.group(1)
        if re.search(r"(?:^|\s)graphql\b", args):
            write = re.search(r"\bmutation\b", raw) is not None
        else:
            write = writes(args, METHOD, FIELDS)
        if write:
            return "`gh api` that writes (a reviewer is read-only)"
    return None


B, R, G = "builder", "reviewer", "rg"
CASES = [
    # (mode, command, denied)
    (B, "git push origin loop0/x-12", False),
    (B, "git push --force origin loop0/x-12", True),
    (B, "git -C ../wt push origin HEAD -f", True),
    (B, "git push --force-with-lease", True),
    (B, "git push --force-if-includes origin x", True),
    (B, "git push origin +loop0/x-12", True),
    (B, "cd wt && git push -uf origin x", True),
    (B, "git push origin loop0/x-12 \\\n  --force", True),
    (B, "timeout 120 git push --force origin x", True),
    (B, "for b in a b; do git push -f origin $b; done", True),
    (B, "if true; then git push --force; fi", True),
    (B, "true && { git push --force; }", True),
    (B, "/usr/bin/git push --force", True),
    (B, "git --git-dir /x/.git push -f", True),
    (B, "FOO='a b' git push -f", True),
    (B, "git push -u origin feature-f", False),
    (B, "git push origin HEAD:refs/heads/loop0/x", False),
    (B, "git -c user.name=x push origin feature-f", False),
    (B, "git push origin x # -f not used", False),
    (B, "gh pr merge 12 --squash --match-head-commit abc1234", False),
    (B, "GH_TOKEN=$(gh auth token -u someone) gh pr merge 12 --admin --squash", True),
    (B, "gh -R o/r pr merge 12 --admin", True),
    (B, "gh pr merge 12 --squash \\\n --admin", True),
    (B, "gh pr merge 12 --squash --body 'not using --admin'", False),
    (B, "git add -A", True),
    (B, "git add --all .", True),
    (B, "git add .", True),
    (B, "git add -u", True),
    (B, "git stage -A", True),
    (B, "git add \\\n  -A", True),
    (B, "git add src/a.rs tests/a.rs", False),
    (B, "git add ./src/a.rs .github/workflows/x.yml", False),
    (B, "git commit -am x", True),
    (B, "git commit --all -m x", True),
    (B, "git commit --amend --no-edit", False),
    (B, "git commit -m 'fix: no more git add -A in the script'", False),
    (B, "git commit -m \"fix: stop using\ngit add -A in the script\"", False),
    (B, "git commit -m 'docs: explain why; git push --force is banned'", False),
    (B, "git commit -m 'feat: x (git add -A removed)'", False),
    (B, "gh pr edit 12 --body \"$(cat <<'EOF'\n| nit | `git add -A` in script | fixed abc |\nEOF\n)\"", False),
    (B, "gh issue comment 3 --body-file - <<'EOF'\n- refused tool call\n  git push --force origin x\nEOF", False),
    (B, "grep -rn 'git push --force' docs/", False),
    (B, "git commit -m x && git push", False),
    (R, "git diff origin/main...HEAD", False),
    (R, "git log --oneline -5 && git show abc1234:src/a.rs", False),
    (R, "git fetch && git status --short", False),
    (R, "git branch --show-current", False),
    (R, "git branch -a", False),
    (R, "git branch newbranch", True),
    (R, "git branch -D old", True),
    (R, "git diff $(git merge-base origin/main HEAD)..HEAD", False),
    (R, "git merge-tree origin/main HEAD", False),
    (R, "git merge origin/main", True),
    (R, "git stash list", False),
    (R, "git stash show -p", False),
    (R, "cargo test; git stash", True),
    (R, "git tag -l", False),
    (R, "git tag --contains abc", False),
    (R, "git tag v1", True),
    (R, "git apply --check x.patch", False),
    (R, "git apply x.patch", True),
    (R, "git clean -n", False),
    (R, "git clean -fd", True),
    (R, "git commit-graph verify", False),
    (R, "git config --get remote.origin.url", False),
    (R, "git config user.name", False),
    (R, "git config --global --get user.name", False),
    (R, "git config --show-origin --list", False),
    (R, "git config user.name x", True),
    (R, "git config --unset user.name", True),
    (R, "git worktree list", False),
    (R, "git worktree add /tmp/review-wt origin/main", True),
    (R, "git remote -v", False),
    (R, "git remote set-url origin x", True),
    (R, "git commit -m fix", True),
    (R, "git -C /tmp/wt checkout main", True),
    (R, "gh pr view 12 --json body", False),
    (R, "gh pr diff 12 | grep -n foo", False),
    (R, "gh pr checks 12 --watch", False),
    (R, "gh issue view 7 --comments", False),
    (R, "gh auth status", False),
    (R, "gh pr comment 12 --body hello", True),
    (R, "gh -R o/r pr comment 12 --body x", True),
    (R, "gh pr -R o/r comment 12 -b x", True),
    (R, "gh pr review 12 --approve", True),
    (R, "gh pr checkout 37", True),
    (R, "gh issue create --title x", True),
    (R, "gh api repos/o/r/pulls/12/comments", False),
    (R, "gh api -X POST repos/o/r/issues/1/comments -f body=x", True),
    (R, "gh api repos/o/r/issues/1/comments -f body=x", True),
    (R, "gh api repos/o/r/issues/1 --method PATCH", True),
    (R, "gh api -X GET repos/o/r/issues -f state=open", False),
    (R, "gh api graphql -f query='query { viewer { login } }'", False),
    (R, "gh api graphql -f query='mutation { addComment(input: {}) { clientMutationId } }'", True),
    (R, "grep -rnE 'x|git commit' scripts/", False),
    (R, "rg -rn RowDescription src/", True),
    (B, "rg -n RowDescription src/", False),
    (B, "rg -nr x src/", True),
    (B, "cd src && rg -r n Foo .", True),
    (B, "git ls-files | xargs rg -rn Foo", True),
    (B, "rg -n Foo --replace Bar src/", False),
    (B, "rg -n -- -r src/", False),
    (B, "rg -n -g '*.rs' Foo src/", False),
    (B, "grep -rn Foo src/ && rg -n Foo src/", False),
    (B, "git commit -m 'never use rg -rn here'", False),
    (B, "rg -pr x src/", True),
    (B, "rg -nrx src/", True),
    (B, "rg -r=n Foo src/", True),
    (B, "rg -ir foo src/", True),
    (B, "rg -Sr foo src/", True),
    (B, "rg -tr foo src/", False),
    (B, "rg -trust foo src/", False),
    (B, "rg -gsrc/** foo", False),
    (B, "rg -e -error src/", False),
    (B, "rg -n foo $(ls -r)", False),
    (B, "rg -n 'a -r b' src/", False),
    (R, "cat > /tmp/report.md <<'EOF'\nFinding 1: the script runs\ngit commit -am without paths\nEOF", False),
    (R, "echo 'finding: `git push --force` at line 3' >> /tmp/r.md", False),
    (R, "python3 scripts/check-conflict-markers.py .", False),
    (R, "git branch 2>/dev/null | head", False),
    (R, "git branch > /tmp/b.txt", False),
    (R, "git tag > /tmp/tags.txt", False),
    (R, "git tag 2>/dev/null", False),
    (R, "git config user.name 2>/dev/null", False),
    (R, "git config user.email > /tmp/e", False),
    (R, "git symbolic-ref HEAD 2>/dev/null", False),
    (R, "git symbolic-ref HEAD refs/heads/x", True),
    (R, "git branch -l 'loop0/*'", False),
    (R, "git branch -q -D x", True),
    (R, "git branch -r --contains abc1234", False),
    (R, "git clean -d -n", False),
    (R, "gh api -X \"DELETE\" repos/o/r/issues/comments/1", True),
    (B, "out=\"$(git push --force origin x 2>&1)\"; echo \"$out\"", True),
    (B, "git commit -m \"note: $(echo \"a\"; git push --force)\"", True),
    (B, "git commit -m \"$(printf '%s' \"fix: x; git add -A removed\")\"", False),
    (B, "out=\"$(git status --short)\"; echo \"$out\"", False),
    (B, "bash <<'EOF'\ngit push --force\nEOF", True),
    (B, "cat <<'EOF' > /tmp/x.md\ngit push --force\nEOF", False),
    (B, "cat <<EOF >> f; git push --force\nbody\nEOF", True),
    (B, "git add \".\"", True),
    (B, "git add ./", True),
    (B, "git add ..", True),
    (B, "git add '*.rs' \"src/a b.rs\"", False),
    (B, "git push origin \"+x\"", True),
    (B, "git push \"--force\"", True),
    (B, "git push origin -f-branch", False),
    (B, "git commit -uall -m x", False),
    (B, "git commit -m 'it'\\''s; git add -A'", False),
    (B, "echo it\\'s; git push -f", True),
    (B, "xargs -n1 git push -f", True),
    (B, "sudo -u x git push -f", True),
    (B, "timeout -k 5 120 git push -f", True),
    (B, "nice -n 10 git push -f", True),
    (B, "env -i FOO=1 git push origin x", False),
    (B, "git commit -m \"wip\" && git push origin \"loop0/x-12\"", False),
    (R, "git branch\ngit log -3", False),
    (R, "git tag\ngit status", False),
    (R, "git config user.name\ngit config user.email", False),
    (R, "git symbolic-ref HEAD\ngit status", False),
    (R, "git clean --force -n", False),
    (R, "git ls-files | xargs grep -n git commit", False),
    (B, "timeout 5 foo\necho git push -f", False),
    (B, "timeout 60 grep -rn git push --force docs/", False),
    (B, "timeout 60 cargo test -- git push -f", False),
    (B, "xargs echo git add -A", False),
    (B, "timeout --signal=KILL 120 git push --force", True),
    (B, "xargs -I {} git push -f origin {}", True),
    (B, "env -u FOO git push -f", True),
    (B, "sudo env FOO=1 git push -f", True),
    (B, "nice timeout 5 git push -f", True),
    (B, "sudo -E -u x env A=1 git push -f", True),
    (B, "az repos pr create --title x --source-branch loop0/x-1 --draft true", False),
    (B, "az repos pr update --id 12 --draft false", False),
    (B, "az repos pr update --id 12 --status completed --bypass-policy true --bypass-policy-reason x", True),
    (B, "az repos pr update --id 12 --bypass-policy", True),
    (B, "az repos pr update --id 12 --bypass-policy false", False),
    (B, "az repos pr update --id 12 --auto-complete true", True),
    (B, "az repos pr create --title x --auto-complete", True),
    (B, "az repos pr update --id 12 --auto-complete false", False),
    (B, "az devops invoke --area git --resource pullRequests --http-method PATCH --in-file m.json", False),
    (B, "az devops invoke --area git --resource pullRequests --http-method PATCH --in-file - <<'EOF'\n"
        "{\"status\": \"completed\", \"completionOptions\": {\"bypassPolicy\": true}}\nEOF", True),
    (B, "git commit -m 'never set bypassPolicy in the merge'", False),
    (R, "az repos pr list --status active -o json", False),
    (R, "az repos pr show --id 12", False),
    (R, "az repos pr policy list --id 12", False),
    (R, "az repos pr reviewer list --id 12", False),
    (R, "az repos policy list --branch main", False),
    (R, "az boards query --wiql 'SELECT [System.Id] FROM workitems'", False),
    (R, "az boards work-item show --id 5", False),
    (R, "az pipelines runs list --pipeline-ids 67 71 --top 10", False),
    (R, "az pipelines show --id 67", False),
    (R, "az devops invoke --area git --resource pullRequestThreads --route-parameters x=y", False),
    (R, "az devops invoke --area git --resource pullRequests --http-method GET", False),
    (R, "az account show", False),
    (R, "az repos pr create --title x", True),
    (R, "az repos pr update --id 12 --draft false", True),
    (R, "az repos pr set-vote --id 12 --vote approve", True),
    (R, "az repos pr reviewer add --id 12 --reviewers x", True),
    (R, "az repos pr checkout --id 12", True),
    (R, "az repos pr policy queue --id 12 --evaluation-id e", True),
    (R, "az boards work-item create --title x --type Task", True),
    (R, "az boards work-item update --id 5 --state Done", True),
    (R, "az boards work-item relation add --id 5 --relation-type parent --target-id 6", True),
    (R, "az pipelines run --id 67", True),
    (R, "az pipelines build queue --definition-id 67", True),
    (R, "az devops invoke --area git --resource pullRequestThreads --http-method POST --in-file t.json", True),
    (R, "az devops invoke --area git --resource pullRequests --http-method \"PATCH\" --in-file m.json", True),
    (R, "az devops invoke --area git --resource pullRequests --in-file m.json", True),
    (R, "az rest --method post --url https://x", True),
    (R, "az rest --url https://x", False),
    (R, "az devops configure --defaults project=x", True),
    (R, "az devops configure -d project=x -l", True),
    (R, "az devops configure -l -o table", False),
    (B, "az repos pr update --id 12 --sta completed", True),
    (B, "az repos pr update --id 12 --aut true", True),
    (R, "az devops configure --defaults project=x --list", True),
    (B, "az repos pr update --id 12 --status Completed", True),
    (B, "az repos pr update --id 12 --stat completed", True),
    (B, "az devops invoke --area git --resource pullRequests --http-method PATCH --in-file \"$GUARD_SELFTEST_DIR/"
        + os.path.basename(__file__) + "\"", True),
    (R, "az login", True),
    (R, "grep -rn 'az repos pr create' docs/", False),
    (B, "az repos pr update --id 12 --status completed", True),
    (B, "az repos pr update --id 12 --status=completed", True),
    (B, "az repos pr update --id 12 --status abandoned", False),
    (B, "az repos pr update --id 12 --auto true", True),
    (B, "az repos pr update --id 12 --auto-comp true", True),
    (B, "az repos pr update --id 12 --auto-complete False", False),
    (B, "az repos pr update --id 12 --bypass-policy False", False),
    (B, "az repos pr update --id 12 --bypass-policy-reason x", False),
    (B, "az repos pr update --id 12 --bypass-policy=true", True),
    (B, "AZ.CMD repos pr update --id 12 --bypass-policy true", True),
    (B, "az devops invoke --area git --resource pullRequests --http-method PATCH --in-file - <<'EOF'\n"
        "{\"completionOptions\": {\"bypassPolicy\": \"true\"}}\nEOF", True),
    (B, "az devops invoke --area git --resource pullRequests --http-method PATCH --in-file "
        + os.path.abspath(__file__), True),  # its docstring names "bypassPolicy": true
    (B, "az devops invoke --area git --resource pullRequests --http-method PATCH --in-file "
        + os.devnull, False),
    (B, "az repos pr update --id 12 --draft --auto-complete true", True),
    (B, "az devops invoke --area git --resource pullRequests --http-method PATCH --in-file \""
        + os.path.abspath(__file__) + "\"", True),
    (R, "az rest -m post -u https://x -b @t.json", True),
    (R, "az rest -m delete -u https://x", True),
    (R, "az rest -u https://x -b @t.json", True),
    (R, "az rest -m get -u https://x", False),
    (R, "az devops extension install --extension-id x --publisher-id y", True),
    (R, "az devops extension list", False),
    (R, "az pipelines runs artifact upload --run-id 1 --artifact-name a --path p", True),
    (R, "az configure --defaults group=x", True),
    (R, "az config set defaults.project=x", True),
    (R, "az config get", False),
    (R, "az account set --subscription x", True),
    (R, "az account clear", True),
    (R, "az devops configure --list", False),
    (R, "az devops configure -l", False),
    (G, "rg -rn foo src/", True),
    (G, "rg -n foo | rg -r x", True),
    (G, "rg -n foo src/", False),
    (G, "rg -tr foo src/", False),
    (G, "git push --force origin main", False),
    (G, "git add -A", False),
    (G, "gh pr merge 1 --admin", False),
    (G, "git commit -m x", False),
]


def selftest():
    os.environ["GUARD_SELFTEST_DIR"] = os.path.dirname(os.path.abspath(__file__))
    failed = 0
    for mode, command, denied in CASES:
        if (check(command, mode) is not None) != denied:
            failed += 1
            print(f"FAIL [{mode}] {'deny' if denied else 'allow'} expected: {command!r}")
    print(f"guard-bash selftest: {len(CASES) - failed} of {len(CASES)} passed")
    return 1 if failed else 0


def main(argv):
    if argv[1:] == ["--selftest"]:
        return selftest()
    mode = argv[1] if len(argv) > 1 else ""
    if mode not in (B, R, G):
        print(f"guard-bash: unknown mode {mode!r}; use builder, reviewer or rg. Nothing is guarded.", file=sys.stderr)
        return 1
    try:
        data = json.load(sys.stdin)
    except ValueError:
        return 0
    if not isinstance(data, dict) or data.get("tool_name") != "Bash":
        return 0
    reason = check(str((data.get("tool_input") or {}).get("command", "")), mode, data.get("cwd"))
    if reason is None:
        return 0
    print(f"BLOCKED by guard-bash ({mode}): {reason}. Do not retry it in another form.", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
