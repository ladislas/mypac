# Project Guidelines

This file is for `mypac`-specific instructions.
The shared execution heuristics live in `shared/AGENTS.md` and are appended by the `extensions/shared-agents` Pi extension.

## Git Commits

This repo uses [gitmoji](https://gitmoji.dev) commit messages:

```text
<emoji> <type>(<scope>): <summary>
```

Example: `✨ feat(auth): Add user authentication system`

- Create atomic commits during implementation, not only at the end of a change.
- Select the file list for each commit explicitly; if unrelated files are already staged, leave them out of the current commit.
- For detailed commit procedure, splitting, emoji selection, and hook behavior, follow `skills/pac-commit/SKILL.md`.

## Git Workflow

### Branch Naming

Branches follow the pattern: `<firstname>/<type>/<topic-more_info>`

- Types: `feature`, `release`, `bugfix`
- Example: `ladislas/feature/dark-mode_ui`

Always create a branch — keep `main` clean.

### Merging

**With a PR** (default for most work):

1. Open a PR for the branch on GitHub
2. From the feature branch, run `git mmnoff`
   - Rebases on the default branch, force-pushes, then merges with `--no-ff`
   - Requires an open PR (command will fail otherwise)

**Without a PR** (small/quick branches):

1. `git checkout main`
2. `git mnoff <branch-name>`

## OpenSpec

- Use OpenSpec in this repo for meaningful multi-step work, not for tiny obvious edits.
- Commit meaningful OpenSpec artifacts under `openspec/` when they preserve rationale and review context.
- For OpenSpec changes, prefer one atomic commit per meaningful numbered task section once that section is complete and verified.
- For OpenSpec changes, include the corresponding `tasks.md` checkbox updates in the same commit as the completed section.
- For non-OpenSpec work, follow the same atomic-commit rule using coherent manual task groups.
- Keep the human in the loop: proposal, design, specs, and tasks should guide implementation rather than replace review and manual judgment.
