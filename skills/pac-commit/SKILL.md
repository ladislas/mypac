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
- If the conversation explicitly ties the work to a GitHub issue (for example `work on this issue https://github.com/<org>/<repo>/issues/123` or `fix #123`), include `closes #123` in the commit body of the commit that is intended to close that issue when merged. Do not guess issue numbers.
- Do not add sign-offs.
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
- When the OpenSpec work started from an explicit GitHub issue, the first commit that captures the change plan or other OpenSpec planning artifacts must include `closes #123` in its body so merging the branch autocloses the issue.

## Fixup workflow

Use `git commit --fixup` + `git rebase --autosquash` when a small correction clearly belongs inside an earlier commit rather than standing as a new one.

**When to suggest it:**

- The user wants to fix or amend something in a recent local commit.
- A follow-up change logically belongs in a specific prior commit (e.g., a typo fix, a missed file, a review correction).
- The branch has not been pushed, or the user is working on a local branch where history rewriting is safe.
- Creating a new standalone commit would clutter the log with noise (e.g., `fix typo`, `oops forgot file`).

**Do not use it** if the target commit is already on `main`, has been pushed to a shared remote, or the user has not confirmed that rewriting is acceptable.

**How to do it:**

1. Find the target commit SHA:

   ```bash
   git log --oneline
   ```

2. Stage the correction normally, then commit with `--fixup`:

   ```bash
   git add <files>
   git commit --fixup=<sha>
   ```

   Git will create a commit titled `fixup! <original message>` automatically — no gitmoji format needed for the fixup commit itself.

   To **reword** a commit message instead of (or in addition to) fixing content, use an `amend!` commit. Create it manually with `--allow-empty` to avoid editor complications:

   ```bash
   git commit --allow-empty -m "amend! <exact original subject>

   <new desired commit message>"
   ```

   During autosquash, git squashes the empty commit and replaces the original's message with the body of the `amend!` commit (i.e., the new message you wrote). The `amend!` subject line must match the original commit's subject exactly for autosquash to locate it.

3. Squash it in with autosquash (replace `<sha>` with the target commit's SHA):

   ```bash
   GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash <sha>^
   ```

   `GIT_SEQUENCE_EDITOR=true` skips the interactive editor and accepts the autosquash plan directly. Omit it if the user wants to review the rebase plan first.

4. Verify the result:

   ```bash
   git log --oneline
   ```

**Tip:** If multiple fixup commits target the same base, you can batch them: stage and `--fixup` each in turn, then run a single `rebase --autosquash` at the end.

## Steps

1. Determine commit scope from the user's request.

   - Treat explicit file paths or globs as the intended scope.
   - Treat extra user instructions as commit guidance.
   - If the conversation explicitly references a GitHub issue URL or issue number, carry that issue into commit planning.
   - If both file scope and extra instructions are present, honor both.
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
   - If the user specified file paths or globs, only stage and commit those files unless the user explicitly asks otherwise.
   - Stage only the files for the current logical unit.
   - Verify the staged file list matches the intended scope.
   - Commit with the format `<emoji> <type>(<scope>): <summary>` or `<emoji> <type>: <summary>` when no scope is needed.
   - Add a body when needed to explain why, tradeoffs, issue references, or breaking-change migration notes.
   - If the work is explicitly tied to a GitHub issue, add `closes #<issue>` to the appropriate commit body. For OpenSpec change-plan commits, that closing reference belongs in the first planning commit.
   - If the change is a small correction to a specific recent local commit, prefer the **fixup workflow** described above instead of creating a standalone fix commit.

6. Report the result.

   - Share each commit hash and message.
   - Mention any files intentionally left unstaged or any reason you stopped.

## Guardrails

- Do not sweep unrelated already-staged files into the commit.
- Do not guess when commit boundaries are unclear.
- Do not guess or fabricate GitHub issue references; only use issues explicitly present in the conversation or current task context.
- Do not push, merge, or rewrite history unless the user explicitly asks. The one approved exception is `git rebase --autosquash` as part of the fixup workflow above, on local branches that have not been pushed to a shared remote.
- Keep the repository's gitmoji, branch, and OpenSpec rules intact even when the user asks casually to “commit this”.
