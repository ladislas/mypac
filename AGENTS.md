# Project Guidelines

## Git Commits

This repo uses [gitmoji](https://gitmoji.dev). Commit format:

```text
<emoji> (<topic>): <message>
```

Example: `🎉 (git): Initial commit`

Use the `gitmoji` CLI to find the right emoji: `gitmoji list`

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
- Keep the human in the loop: proposal, design, specs, and tasks should guide implementation rather than replace review and manual judgment.
