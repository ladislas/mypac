---
name: pac-review
description: "Review code changes following project review guidelines. Use when the user asks to review code, uncommitted changes, a pull request, a branch comparison, or a specific commit."
license: MIT
compatibility: Git repository; gh CLI required for pull request reviews.
metadata:
  author: mypac
  stage: shared
---

# Code Review

Use this skill for defect-oriented code review, including `/review-start` sessions.

## Resolve the target and inspect the diff first

Resolve exactly what the user asked to review, then inspect that diff before broad context. Use the matching minimal command:

```bash
# uncommitted: include staged, unstaged, and untracked files
git status --porcelain
git diff
git diff --staged
git ls-files --others --exclude-standard

# branch comparison
git merge-base HEAD <base-branch>
git diff <merge-base-sha> HEAD

# commit
git show <sha>

# pull request
gh pr view <number> --json baseRefName,title,headRefName
gh pr diff <number>
```

PR and branch reviews are read-only committed comparisons: do not check out or switch branches, stage, stash, or otherwise alter the active worktree or index. For a branch other than HEAD, use its explicit ref as both the merge-base input and diff endpoint; resolve the intended base/head refs before comparing. Never use a one-ended `git diff <merge-base-sha>` for a committed comparison: it includes local changes. Include staged, unstaged, and untracked work only when the user requests an uncommitted review; read the relevant untracked file contents as well as listing their paths.

Read supporting files at the reviewed committed refs (for example, `git show <head-ref>:<path>`), not from an unrelated or dirty local checkout. If remote PR refs are needed for context, fetch into a separate review ref without changing the active branch or index. If the requested review requires checkout or runtime execution, ask for authorization to use an isolated worktree at the reviewed commit; do not silently switch or clean the user's workspace.

For a requested file snapshot rather than a diff, read only those files. After inspecting the diff, read surrounding code, callers, tests, or runtime context only to prove or disprove a concrete finding. Do not sweep repository docs or unrelated source for general understanding.

## Finding bar

Flag an issue only when all relevant conditions hold:

1. It meaningfully affects correctness, performance, security, maintainability, or operational safety.
2. It is discrete and actionable, not a broad concern or several issues combined.
3. It was introduced by the reviewed diff, not pre-existing code.
4. The author would likely fix it if aware.
5. It does not depend on unstated assumptions about intent or the codebase.
6. Its impact is proved: identify the affected scenario and code path rather than speculating.
7. It is not clearly an intentional tradeoff.
8. The expected rigor is consistent with the repository.

Do not stop after the first finding. Ignore trivial style unless it obscures meaning or violates an explicitly supplied standard. Prefer simple fixes over unnecessary wrappers or abstractions.

### Security and untrusted input

Treat changed trust boundaries as high signal:

- Restrict redirect targets such as `next_page` to trusted destinations.
- Flag non-parameterized SQL.
- Protect user-supplied URL fetches against local-resource access, including DNS resolution/rebinding behavior.
- Escape output for its destination context; do not substitute vague sanitization when escaping is available.

### Fail-fast error handling (strict)

Review every added or changed `try/catch` and other local recovery path. Identify what can fail and why handling belongs at that exact layer.

- Prefer propagation when the current scope cannot fully recover while preserving correctness.
- Flag swallowed failures, message-based error matching, logging-and-continue, or fallback returns such as `null`, `[]`, or `false` that hide failure signals.
- JSON parsing/decoding fails loudly by default. Quiet compatibility fallback requires an explicit requirement and focused tests.
- Boundary handlers such as HTTP routes, CLI entrypoints, and supervisors may translate failures, but must not pretend success or silently degrade.
- A catch added only for lint/style is a bug. When uncertain, prefer fail-fast behavior over silent corruption.

Also treat missing back pressure as a system-stability risk and changes likely to create operational or on-call risk as high signal.

## Findings and comments

Each finding must:

- use a title tagged `[P0]`, `[P1]`, `[P2]`, or `[P3]`;
- name the file and the shortest useful line range (normally no more than 5–10 lines);
- reference a location that overlaps the actual diff;
- explain the failure scenario/environment and why it matters;
- be brief, matter-of-fact, and at most one paragraph.

Priority meanings:

- `[P0]` — universal release/operations blocker; does not depend on input assumptions.
- `[P1]` — urgent; address in the next cycle.
- `[P2]` — normal actionable defect.
- `[P3]` — low priority but still worth fixing.

Keep snippets under three lines. Use a `suggestion` block only for concrete replacement code, with exact indentation and no commentary inside it. Do not generate a full PR fix during review.

## Verdict and output contract

1. List every qualifying finding with priority, diff-local location, and explanation.
2. If none qualify, explicitly say the code looks good.
3. Give the overall verdict exactly as `correct` when there are no blocking issues or `needs attention` when blocking issues exist.
4. Finish with the following section, after findings and verdict.

## Human Reviewer Callouts (Non-Blocking)

Include only applicable callouts, preserving the exact bold labels:

- **This change adds a database migration:** <files/details>
- **This change introduces a new dependency:** <package(s)/details>
- **This change changes a dependency (or the lockfile):** <files/package(s)/details>
- **This change modifies auth/permission behavior:** <what changed and where>
- **This change introduces backwards-incompatible public schema/API/contract changes:** <what changed and where>
- **This change includes irreversible or destructive operations:** <operation and scope>
- **This change adds or removes feature flags:** <feature flags changed; call out re-use of dormant flags>
- **This change changes configuration defaults:** <config variable changed>

These are informational, not findings. They do not change the verdict without an independent defect. If none apply, write `- (none)`.

## Conditional follow-ups

### Standards + Spec

Only when the user explicitly asks for a Standards review, Spec review, or Standards + Spec follow-up, load `skills/pac-review-standards-spec/SKILL.md`. Do not run Standards or Spec gathering during the default review. Keep follow-up findings separate from default findings.

### Fix reviewed findings

Only when the user is actually entering a workflow that applies fixes to review findings, load `FIX_FINDINGS.md` before editing. Do not read or load `FIX_FINDINGS.md` for a read-only review. The reference owns blame targeting, atomic fixups, uncommitted-review handling, and history-safety procedure.
