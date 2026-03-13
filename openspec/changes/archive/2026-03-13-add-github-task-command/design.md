## Context

This repository already uses repo-local opencode commands for reusable workflows, and it uses OpenSpec to preserve rationale for non-trivial changes. The new `/add-task` command should fit that model while staying lightweight enough to use during active work without breaking focus. The command will rely on `gh` so issue creation happens against the current repository in the user's existing authenticated GitHub CLI context.

## Goals / Non-Goals

**Goals:**

- Make `/add-task <description>` create a GitHub issue in the current repository with minimal friction.
- Ensure every created issue includes the `needs triage` label.
- Support both a fast path for simple tasks and a guided path for larger tasks or stories.
- Produce richer issue bodies for larger work so future review and implementation are easier.

**Non-Goals:**

- Integrate with GitHub Projects, milestones, or assignees in the MVP.
- Build a sophisticated task-estimation or issue-scoring system.
- Replace OpenSpec planning for work that should still be modeled as a structured change.

## Decisions

- Implement the feature as a repo-local command in `.opencode/commands/add-task.md`.
  - This matches the repository's current pattern for reusable guided workflows.
  - Alternative considered: a standalone shell script. Rejected because command behavior belongs with other opencode session workflows in this repo.
- Use `gh issue create` to create the issue and `gh label create` only when the `needs triage` label does not already exist.
  - This keeps the workflow inside the authenticated GitHub CLI environment and avoids inventing a separate API integration.
  - Alternative considered: requiring the label to exist ahead of time. Rejected because first-run setup friction would defeat the purpose of quick capture.
- Use a simple classification heuristic for the MVP.
  - Short, single-purpose input can become a simple issue immediately, while inputs that look multi-part, story-like, or explicitly request more detail should trigger a few follow-up questions.
  - Alternative considered: always asking follow-up questions. Rejected because it slows down the common quick-capture case.
- Generate two issue body shapes.
  - Simple tasks can use either no body or a minimal note, while larger tasks should use a structured template with sections such as context, desired outcome, and notes for future work.
  - Alternative considered: one universal template. Rejected because it would make simple task capture unnecessarily verbose.

## Risks / Trade-offs

- [GitHub CLI is unavailable or unauthenticated] -> Mitigate by failing with a clear message that explains the `gh` requirement.
- [The simple/large heuristic misclassifies some tasks] -> Mitigate by keeping the heuristic intentionally transparent and allowing the guided path when the input suggests ambiguity.
- [Automatic label creation could fail because of permissions] -> Mitigate by surfacing the exact GitHub CLI failure and avoiding silent fallback without the required label.
- [Rich issue bodies become inconsistent over time] -> Mitigate by defining a stable larger-task template in the command instructions.
