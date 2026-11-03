# Release settings

Settings for release management in this repo: the `release-manager` and `release-classifier` agents, the
`/release` skill, and the workflow `package.yml`.

**Phase 0: shadow.** Nothing here changes how PRs merge. The labels below are recorded, but they restrict
nothing yet. privacy-guard has never been released, and its first stable version is 1.0.0, so until 1.0.0
is generally available everything may go into the default branch (the first-stable rule).

## Settings

```yaml
product: "privacy-guard"
phase: 0                      # 0 shadow | 1 first release | 2 enforced
first_stable: "1.0.0"         # until this version is GA everything may go into the default branch
version_file: "package.json"  # its "version" field, major.minor.patch; only the release-manager changes it, in a PR
build_offset: 0               # build number = package workflow run_number + this
next_increment: minor         # what the default branch builds towards after first_stable is GA
tag_format: "v{major}.{minor}.{patch}"
package_workflow: "package.yml"
release_base: "release"       # the branch that plays the default branch (see Deviations)

docs_repo: "KenKor/privacy-guard"   # this repo: the help is README.md (see Deviations)
docs_checkout: "."
docs_help_path: "README.md"
docs_tag_format: "v{major}.{minor}.{patch}"
docs_version_vars: "none yet"
docs_batch: 5

release_owner: "KenKor"
release_owner_deputy: "none"
roles: "the course author holds every role: product owner, solution architect, lead developer, release owner and documentation owner"
```

## Labels and milestones

| Label | Meaning |
|---|---|
| `release:patch` | May ship in a patch of a supported line |
| `release:minor` | Ships in the next increment |
| `release:major` | Breaks an item of the supported contract below; ships only in a major |
| `high-risk` | Stronger review and testing |
| `expedite` | Needs an expedited patch; set only by a person |
| `docs-needed` | The help must follow this change |
| `release` | The release issue |

Milestone for the next release: `2026-Q4`.

## Supported contract

What a user relies on, and what may change only in a major release:

- The commands, their arguments and options, their output lines and their exit codes (README, Commands)
- The ledger file: its name (`privacy-guard-ledger.json`; `ledger.json` before 0.2.0), where it is looked for, and its format
- The subject file (`subject.yaml`): its name and its keys
- The broker playbook format (`brokers/<name>.yaml`)
- The dry-run rule: nothing is sent without `--confirm`

Not in the contract: the source modules, the tests, the practice site, CI.

## Deviations

- **A practice repository.** It is the sandbox of a training course. The branch `release` plays the
  default branch: pull requests go into `release`, "since the last release" means merged into `release`,
  and `/release candidate` packages `release`. Use `release_base` wherever the agents say default branch.
- **The help lives in this repo.** `README.md` is the user guide, so `docs_repo` names this repo, and the
  documentation PR goes into `release_base` like any other PR.
