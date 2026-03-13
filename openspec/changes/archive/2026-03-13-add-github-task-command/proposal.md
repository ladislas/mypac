## Why

I need a very fast way to capture future work directly in the current GitHub repository without breaking flow. Right now, tasks that come up during active work are easy to forget or leave in local notes instead of turning into repository-backed backlog items.

## What Changes

- Add a repo-local `/add-task` opencode command that creates a GitHub issue in the current repository.
- Ensure issues created by this workflow always receive the `needs triage` label so they can be reviewed and organized later.
- Support a fast path where a short command argument can become a simple issue with little or no extra prompting.
- Support a guided path for larger tasks or stories where the command asks for a small amount of extra context and creates a richer issue body.

## Capabilities

### New Capabilities

- `github-task-capture`: Capture future work as GitHub issues from the current repository through a lightweight or guided issue-creation workflow.

### Modified Capabilities

None.

## Impact

- Adds a new custom command under `.opencode/commands/`.
- Depends on `gh` being available and authenticated for the current repository.
- Introduces a lightweight issue triage convention centered on the `needs triage` label.
