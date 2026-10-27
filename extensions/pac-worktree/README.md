# Pac worktree

Worktrunk-backed Pi shortcuts for this repository. Worktrunk owns worktree lifecycle and hooks; the extension does not implement raw Git worktree management.

## Commands

```text
/pac-worktree
/pac-worktree 550
/pac-worktree https://github.com/ladislas/mypac/issues/550
/pac-worktree 550 --type bugfix
/pac-worktree branch ladislas/feature/experimental
/pac-worktree list
/pac-worktree status
```

The bare command offers an Issue / Branch / List / Status menu. Argument completions include examples and `--type feature|bugfix|release`. `ls` is an alias for `list`. `/worktree` has been replaced, without a competing compatibility alias.

## Issue identity and branches

Numbers resolve against `gh repo view` in the current repository. GitHub issue URLs must identify that same repository (case-insensitive); cross-repository URLs fail before Worktrunk mutation, without an override.

Existing worktrees and local branches are matched by delimited issue number, not the current title. #550 never matches #5500. A title change or `--type` override does not rename an existing branch. Multiple matches fail with an explicit branch-selection command rather than silently choosing one.

New branches follow `ladislas/<type>/<number>-<title-slug>`. The exact GitHub `bug` label defaults to `bugfix`; otherwise the default is `feature`. Use `--type feature|bugfix|release` to override. This is deliberately a mypac naming policy, not a generic repository-policy parser.

## Setup and trust

Requirements: authenticated `gh`, Git, `wt` with `config approvals list --format=json` support (verified with 0.75.0), and the tools required by project hooks.

Before creating a worktree, the extension checks project command approvals. Unapproved commands are displayed, with instructions to review and explicitly approve them in a terminal:

```sh
wt config approvals list
wt config approvals add
```

Then retry the original command. Unsupported or malformed approval inspection fails closed. The extension never adds approvals or passes `--yes` / `--no-hooks`. Already-approved hooks run normally. Existing worktrees are reused without re-running creation hooks.

Creation uses `wt switch --create --no-cd <branch>` for a new branch, or omits `--create` for an existing local branch. `--no-cd` is intentional: a child process cannot change the original Pi session's directory. Worktrunk still runs hooks. Setup errors are surfaced; a partially created worktree may remain and can be inspected with `wt list`.

In this repository, blocking `pre-start` hooks run `mise trust`, `mise install`, and `npm ci`. The extension does not independently execute setup commands or alter shell integration.

## Manual launch

Output includes a single-line, shell-safe command, without Markdown fences or a submitted prompt:

```sh
wt switch ladislas/feature/550-example -x pi
```

Worktrunk's `-x` runs Pi in the selected worktree without requiring shell integration. It also makes launch recovery possible without recreating the worktree. `list` and `status` remain read-only.

Worktree removal, merge UX, and terminal-manager frameworks are out of scope.
