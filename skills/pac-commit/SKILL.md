---
name: pac-commit
description: Create, split, or plan git commits that follow this repository's commit workflow. Use when the user asks to commit changes directly, split changes into commits, or make an implementation commit along the way.
license: MIT
compatibility: Git repository; gitmoji CLI is optional.
metadata:
  author: mypac
  stage: shared
---

# Create atomic git commits

Use this skill whenever the user asks to create commits directly in normal conversation, not only when they invoke `/commit`.

## Repository commit policy

- Commit format:

  ```text
  <emoji> <type>(<scope>): <summary>
  ```

  Scope is optional:

  ```text
  <emoji> <type>: <summary>
  ```

  Example: `✨ feat(auth): Add user authentication system`

- Choose the most appropriate gitmoji from the common shortlist below. If none fit well and `gitmoji` is installed, you may run `gitmoji list` for the full catalog.
- Use one emoji per commit and one primary purpose per commit.
- Use a conventional type such as `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, or `perf`.
- Keep the scope short and lowercase when used, such as `git`, `docs`, `ui`, `deps`, or `agent`.
- Keep summaries concise, imperative, and without a trailing period.
- If a commit could fit multiple categories, choose the emoji and type that best reflect the primary impact of the change rather than the implementation detail.
- Use a body when needed to explain why the change exists, tradeoffs, issue references, or migration notes instead of repeating the diff.
- Commit during implementation when a meaningful task group or work slice is complete and verified; do not wait until the very end.
- Use one coherent commit per meaningful task group. Do not create one commit per file or tiny checkbox, and do not batch unrelated work into one large commit.
- Select the file list for each commit explicitly. If unrelated files are already staged, leave them out of the current commit.
- If the changes naturally split into multiple unrelated commit groups, STOP and present the proposed split for approval before committing anything.
- If it is unclear whether a file belongs in the commit, ask the user before staging or committing it.
- Never use `--no-verify`. If a hook fails, report the failure clearly and do not bypass it.
- Only commit. Do not push unless the user explicitly asks.
- Do not commit directly on `main`. This repository keeps `main` clean and expects work on a branch named `<firstname>/<type>/<topic-more_info>`.

## Common gitmoji shortlist

- ✨ new feature
- 🐛 bug fix
- 📝 documentation
- ♻️ refactor
- ✅ tests
- 🔧 configuration or tooling
- 🚚 move or rename files
- 🔥 remove code or files
- 💄 UI or style polish
- ⬆️ upgrade dependencies
- ⬇️ downgrade dependencies
- 🔒 security hardening
- 🚑️ critical hotfix

Use the closest matching emoji from this shortlist for normal work.
Prefer the matching conventional type alongside the emoji, for example:

- ✨ → `feat`
- 🐛 → `fix`
- 📝 → `docs`
- ♻️ → `refactor`
- ✅ → `test`
- 🔧 → `chore`
- ⚡️ → `perf`

When a commit could fit several categories, prefer the one with the greatest impact. A useful rule of thumb is:

- 💥 breaking change
- ✨ feature
- 🐛 fix
- ♻️ refactor

Use `💥` for breaking changes and add a short body explaining what changed and what consumers need to do.
Do not block committing just because the `gitmoji` CLI is unavailable.

## OpenSpec-specific rules

When the work follows an OpenSpec change:

- Prefer one atomic commit per meaningful numbered task section once that section is complete and verified.
- Include the corresponding `tasks.md` checkbox updates in the same commit as the completed implementation slice.
- Commit meaningful OpenSpec artifacts when they preserve rationale, review context, or implementation history.

## Steps

1. Determine commit scope from the user's request.

   - Treat explicit file paths as the intended scope.
   - Treat extra user instructions as commit guidance.
   - If the intended scope is ambiguous, ask before committing.

2. Inspect the repository state.

   - Run `git branch --show-current`.
   - Run `git status` and `git diff` for the relevant scope.
   - If useful, inspect recent subjects with `git log -n 50 --pretty=format:%s` to reuse local topic conventions.

3. Verify branch safety.

   - If the current branch is `main`, pause and ask before proceeding.
   - Follow the repository branch naming convention if a new branch is needed.

4. Decide commit grouping.

   - Group the scoped changes into logical, atomic units.
   - If there is more than one unrelated group, present the proposed split and wait for approval.

5. Create each approved commit.

   - Choose the emoji from the shortlist in this skill.
   - If none fit well and `gitmoji` is available, you may run `gitmoji list`.
   - Stage only the files for the current logical unit.
   - Verify the staged file list matches the intended scope.
   - Commit with the format `<emoji> <type>(<scope>): <summary>` or `<emoji> <type>: <summary>` when no scope is needed.
   - Add a body when needed to explain why, tradeoffs, issue references, or breaking-change migration notes.

6. Report the result.

   - Share each commit hash and message.
   - Mention any files intentionally left unstaged or any reason you stopped.

## Guardrails

- Do not sweep unrelated already-staged files into the commit.
- Do not guess when commit boundaries are unclear.
- Do not push, merge, or rewrite history unless the user explicitly asks.
- Keep the repository's gitmoji, branch, and OpenSpec rules intact even when the user asks casually to “commit this”.
