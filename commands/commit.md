---
description: Create atomic git commits with gitmoji following project conventions
subtask: true
model: anthropic/claude-haiku-4-5-20251001
---

# Create atomic git commits

Before proceeding, read and follow `skills/pac-commit/SKILL.md`.

This command is the structured execution wrapper around that shared commit policy.

## Format

```text
<emoji> <type>(<scope>): <summary>
```

Scope is optional:

```text
<emoji> <type>: <summary>
```

Example: `✨ feat(auth): Add user authentication system`

## Current state

!`git branch --show-current`

!`git status`

!`git diff HEAD`

## Steps

1. Follow `skills/pac-commit/SKILL.md` for the repository's commit policy, including branch safety, gitmoji shortlist selection, atomic grouping, OpenSpec slice rules, and explicit staging.
2. Analyze the changes above and group them into logical, atomic units — unrelated changes belong in separate commits.
3. If you identify multiple unrelated groups, STOP and present your proposed split to the user for approval before proceeding.
4. For each commit group, in order:

   1. Pick the most appropriate emoji from the shortlist in `skills/pac-commit/SKILL.md`; if needed and available, run `gitmoji list` for the full catalog.
   2. Select the file list for this commit explicitly; do not assume every staged file belongs in the current commit.
   3. If unrelated files are already staged, leave them out of the current commit group.
   4. Stage only the files for this commit (`git add <files>`).
   5. Verify the staged file list matches the intended logical unit before committing.
   6. Use one emoji and one primary purpose for the commit; if the change is breaking, prefer `💥` and explain the migration in the body.
   7. Commit with the message: `<emoji> <type>(<scope>): <summary>` or `<emoji> <type>: <summary>` when no scope is needed. Add a body when needed to explain why, tradeoffs, issue references, or migration notes.

5. Report each commit hash and message when done

## Constraints

- Never use `--no-verify`
- Do not commit directly on `main`; pause and ask if the current branch is `main`
- Keep summaries concise (imperative mood, no period at the end)
- Use one emoji and one primary purpose per commit
- Use a conventional type such as `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, or `perf`
- Scope should be a short lowercase noun when used (e.g. `auth`, `ui`, `api`, `git`, `deps`)
- If a body is needed, use it for why, tradeoffs, issue references, or migration notes rather than restating the diff
- Do not sweep unrelated staged files into a commit just because they were already staged
- Hint from user (if any): $ARGUMENTS
