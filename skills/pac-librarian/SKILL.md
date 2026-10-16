---
name: pac-librarian
description: "Use when the task requires inspecting, searching, or comparing remote Git repository contents, whether the source reference comes from the user or investigation. Reuse and refresh managed checkouts under ~/.cache/checkouts/<host>/<org>/<repo>. An incidental repository reference alone does not trigger checkout."
license: MIT
compatibility: Pi coding agent; git and bash required.
metadata:
  author: mypac
  stage: shared
---

# Cache remote repository checkouts

Use this skill when answering the task requires inspecting, searching, or comparing remote Git repository contents, whether the reference comes from the user or investigation (GitHub/GitLab/Bitbucket URLs, `git@...`, or `owner/repo` shorthand). Use the managed cache below rather than an ad-hoc fresh clone.

A repository reference used only as attribution, a citation, a dependency name, an issue/PR link, or contextual background does not by itself justify cloning or refreshing.

The goal is to keep a reusable local checkout that is:

- **stable** (predictable path)
- **up to date** (periodic fetch + fast-forward when safe)
- **efficient** (shallow partial clone with `--depth=1 --filter=blob:none`, no repeated full clones)

## Cache location

Repositories are stored at:

`~/.cache/checkouts/<host>/<org>/<repo>`

Example:

`github.com/mitsuhiko/minijinja` → `~/.cache/checkouts/github.com/mitsuhiko/minijinja`

## Command

```bash
bash checkout.sh <repo> --path-only
```

Examples:

```bash
bash checkout.sh mitsuhiko/minijinja --path-only
bash checkout.sh github.com/mitsuhiko/minijinja --path-only
bash checkout.sh https://github.com/mitsuhiko/minijinja --path-only
```

The script will:

1. Parse the repo reference into host/org/repo.
2. Shallow-clone it if missing.
3. Reuse existing checkout if present.
4. Fetch from `origin` when stale (default interval: 300s).
5. Attempt a fast-forward merge if the checkout is clean and has an upstream.

## Update strategy

- Default behavior is **throttled refresh** (every 5 minutes) to avoid unnecessary network calls.
- Shallow refreshes deepen the existing boundary enough to retain fast-forward ancestry across newly added upstream commits. They remain shallow unless the boundary reaches the repository root naturally.
- Checkouts that another workflow has unshallowed use an ordinary full-history fetch and remain full-history.
- `--path-only` prints a path only when the checkout is current. If fetched upstream work cannot be applied because tracked files are dirty, history diverged, or no upstream is configured, it reports the stale state on stderr and exits nonzero without discarding local work.
- Force immediate refresh with:

```bash
bash checkout.sh <repo> --force-update --path-only
```

## Recommended workflow

1. Resolve repository path via `checkout.sh --path-only`.
2. Use that path for searching, reading, and analysis.
3. When later source inspection of the same repo is needed, call `checkout.sh` again; it will find and update the cached checkout.

## If edits are needed

Prefer not to edit directly in the shared cache. Create a separate worktree or copy from the cached checkout for task-specific modifications.

## Notes

- `owner/repo` defaults to `github.com`.
