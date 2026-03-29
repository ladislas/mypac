## Why

`/pac-apply` currently describes implementation as work performed directly in the main agent context. For phase 1, the workflow needs a narrower, safer execution model where the main agent stays in control of planning and review but delegates each concrete implementation slice to a general-purpose subagent.

## What Changes

- Update `/pac-apply` guidance so the main agent reads change context, decides the next task or small coherent batch, and delegates that implementation work to the general subagent.
- Clarify that delegated execution is scoped per task or small coherent batch, not as whole-change autonomy.
- Clarify that the main agent reviews delegated results, updates task state, continues when work is complete, and pauses on blockers or ambiguity.
- Update the matching `pac-openspec-apply-change` skill so it describes the same delegated implementation workflow and uses actual harness/tooling terminology.
- Keep the existing atomic commit guidance intact while fitting it into the delegated apply flow.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `ai-workflow-conventions`: clarify that `/pac-apply` uses a human-guided delegated implementation loop where the main agent orchestrates and a general subagent executes scoped implementation slices.

## Impact

- Affected files include `commands/pac-apply.md`, `skills/pac-openspec-apply-change/SKILL.md`, and the `ai-workflow-conventions` change delta for repository workflow expectations.
- No application runtime, API, or dependency changes are expected in this phase.
- Contributors and agents get a clearer implementation contract that preserves human control while using delegation for focused execution.
