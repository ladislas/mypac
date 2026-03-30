---
description: Create atomic git commits with gitmoji following project conventions
subtask: true
model: anthropic/claude-haiku-4-5-20251001
---

# Create atomic git commits

Create one or more atomic git commits following the project's gitmoji conventions.

## Format

```text
<emoji> (<topic>): <message>
```

Example: `🎉 (git): Initial commit`

## Current state

!`git status`

!`git diff HEAD`

## Steps

1. Analyze the changes above and group them into logical, atomic units — unrelated changes belong in separate commits
2. If you identify multiple unrelated groups, STOP and present your proposed split to the user for approval before proceeding
3. For each commit group, in order:

   1. Run `gitmoji list` to pick the most appropriate emoji.
   2. Select the file list for this commit explicitly; do not assume every staged file belongs in the current commit.
   3. If unrelated files are already staged, leave them out of the current commit group.
   4. Stage only the files for this commit (`git add <files>`).
   5. Verify the staged file list matches the intended logical unit before committing.
   6. Commit with the message: `<emoji> (<topic>): <message>`.

4. Report each commit hash and message when done

## Constraints

- Never use `--no-verify`
- Keep messages concise (imperative mood, no period at the end)
- Topic should be a short lowercase noun (e.g. `auth`, `ui`, `api`, `git`, `deps`)
- Do not sweep unrelated staged files into a commit just because they were already staged
- Hint from user (if any): $ARGUMENTS
