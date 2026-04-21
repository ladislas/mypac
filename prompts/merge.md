---
description: Merge the current branch using the correct strategy based on whether a PR exists
---

Merge the current branch using the correct strategy based on whether a PR exists.

## Current state

!`git branch --show-current`

!`gh pr list --head $(git branch --show-current) --state open`

## Steps

1. Read the current branch and PR status above.
2. If on `main` and no arguments are provided, abort with a clear error message.
3. Choose the strategy:

   - **PR found** → run `git mmnoff` from the current branch.
   - **No PR, argument provided** → run `git checkout main && git mnoff $@`.
   - **No PR, no argument** → abort and tell the user to either open a PR or pass the branch name as an argument.

4. Show `git gl -n 10` to confirm the result.

## Constraints

- Never force-push manually — `mmnoff` handles that internally.
- Confirm the chosen strategy to the user before executing.
- Branch name argument (if provided): $@
