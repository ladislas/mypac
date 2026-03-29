## Why

The repository currently explains atomic commits in a few isolated places, but it does not state a consistent rule for how implementation work should be committed during either OpenSpec-driven changes or manual todo-driven work. That gap leads to two bad failure modes: one giant commit at the end, or commits that sweep in unrelated staged files just because they happened to be sitting there.

## What Changes

- Document a repository-wide rule that meaningful implementation work must be committed in small, coherent, verifiable units during the work rather than only at the end.
- Clarify that OpenSpec implementation should usually create one commit per meaningful task section or task group once that section is complete and verified.
- Clarify that OpenSpec commits should include the corresponding `tasks.md` checkbox updates in the same atomic commit as the implementation slice they describe.
- Clarify that non-OpenSpec/manual work follows the same atomic-commit principle using coherent manual task groups.
- Update commit guidance so commit file selection is explicit, and unrelated staged files must be left out rather than bundled into the current commit.
- Align the OpenSpec apply guidance, repository playbooks, and build-agent instructions around the same commit model.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `ai-workflow-conventions`: clarify that both OpenSpec and non-OpenSpec implementation workflows use atomic commits tied to coherent progress boundaries, with explicit file selection for each commit, and matching `tasks.md` updates for OpenSpec slices.

## Impact

- Affected files include OpenSpec workflow docs, the `/pac-apply` command, the `pac-openspec-apply-change` skill, repository agent guidance, and commit workflow guidance.
- No runtime API or dependency changes are expected.
- Contributors and agents will have clearer commit boundaries, lower review friction, and less risk of unrelated staged files being committed by accident.
