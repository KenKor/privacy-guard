---
name: release
description: Release management for this repo. Starts the release-manager agent with one subcommand - status, notes, docs, candidate, freeze, readiness, admit, backport - or the release-classifier on one PR or issue (classify <n>). Invoke as "/release status", "/release classify 1234", etc. Only when the user invokes it, a /loop prompt or schedule names it, or the shepherd sends it. Settings in docs/agents/release.md.
metadata:
  version: "0.1"
---

# Release

A thin starter. The work is done by two agents in `.claude/agents/`:
- `release-manager` does the release role;
- `release-classifier` labels one change.

The settings are in `docs/agents/release.md`.

## Arguments

| Argument | Starts | Phase |
|---|---|---|
| `status` (default) | `release-manager status` | 0+ |
| `notes` | `release-manager notes` | 0+ |
| `docs` | `release-manager docs` | 0+ |
| `candidate [<ref>]` | `release-manager candidate` | 0 (preview), 1+ |
| `classify <n>` | `release-classifier` on PR or issue `<n>` | 0+ |
| `classify unlabelled` | `release-classifier` on each merged PR since the last release without a `release:*` label, at most 10 | 0+ |
| `freeze`, `readiness` | `release-manager <subcommand>` | 1+ |
| `admit <PR>`, `backport <PR>` | `release-manager <subcommand>` | 2 |

## Steps

1. Read the settings. If the file is missing or names no `docs_repo`, stop. Tell the user that the repo
   is not release-managed.
2. If the subcommand needs a later phase than the settings' `phase`, stop and say which phase it
   needs. Do not run it early.
3. Spawn the agent with the subcommand and its argument, and nothing else: no conclusions of yours.
4. Report its deliverable in a few lines, with links. Do not repeat what it put in the release issue.

## Never

Run `publish.yml`, create tags, or answer the publish question. Those are the release owner's.
