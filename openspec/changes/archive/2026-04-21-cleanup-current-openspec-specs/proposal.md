## Why

The current active OpenSpec specs under `openspec/specs/` no longer fully match the repository's real supported workflow. A small cleanup is needed so the active spec surface stays honest without rewriting archived history or legacy reference material.

## What Changes

- Update the active OpenSpec workflow spec to match the current `/pac-apply` behavior, which keeps implementation in the main agent context instead of promising delegated subagent execution.
- Simplify the pre-commit validation spec so it reflects the currently supported repository contract and no longer treats legacy `.opencode/` Markdown override behavior as active supported workflow.
- Remove the unsupported GitHub task capture spec that currently describes a `/add-task` capability that is not implemented in the repository.
- Leave archived OpenSpec history and unchanged current specs alone.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `ai-workflow-conventions`: align the `/pac-apply` requirements with the current main-agent execution model and keep the human-in-the-loop guidance accurate.
- `content-precommit-validation`: narrow the active validation contract to the supported YAML/Markdown hooks, root config, `openspec/` override, and setup guidance.
- `github-task-capture`: retire the unsupported current capability from the active spec surface.

## Impact

- Affected artifacts: `openspec/specs/ai-workflow-conventions/spec.md`, `openspec/specs/content-precommit-validation/spec.md`, and `openspec/specs/github-task-capture/spec.md`.
- No runtime feature work is expected beyond keeping the active specs aligned with existing repository behavior.
- README, prompts, skills, and hook configuration remain the reference points used to verify the spec cleanup.
- Non-goal: rewriting archived OpenSpec history or broadly deleting legacy `.opencode/` files.
