## Why

Older archived OpenSpec changes can still be surfaced as repository context while the agent is working. Some of that archived material now documents deprecated or unsupported workflows, so keeping it around unchanged risks steering the agent toward stale instructions.

## What Changes

- Review archived OpenSpec changes for repository-context safety rather than preserving every historical change directory by default.
- Remove archived change trails that primarily document deprecated or unsupported behavior and are more likely to confuse the agent than help future readers.
- Keep archived changes that still describe current supported behavior or clearly document removals without restating obsolete requirements as active guidance.
- Document the repository rule for curating archived OpenSpec history when old artifacts become misleading context.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `ai-workflow-conventions`: clarify that archived OpenSpec changes are retained only when they remain safe and useful as repository context for humans and agents.

## Impact

- Affected artifacts under `openspec/changes/archive/`
- OpenSpec workflow guidance under `openspec/specs/ai-workflow-conventions/spec.md`
- Supporting documentation that explains archive-retention expectations
