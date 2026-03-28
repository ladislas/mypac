## Why

The shared OpenCode kit currently requires pointing `OPENCODE_CONFIG_DIR` at `.opencode/`, which exposes an internal implementation detail and makes the canonical shared asset layout harder to discover and maintain. Moving the human-edited kit directories to the repository root and standardizing on a `mise run` launcher gives the local workflow a clearer entrypoint while preserving the layering model that motivated the shared kit.

## What Changes

- Move the canonical shared OpenCode asset directories to repository-root `agents/`, `commands/`, and `skills/` so the shared kit shape is obvious when browsing the repo.
- Define the repository root, rather than `.opencode/`, as the supported `OPENCODE_CONFIG_DIR` target for loading the shared kit.
- Add and document a supported local workflow based on `mise run opencode` and related `mise` tasks that launch OpenCode with `OPENCODE_CONFIG_DIR` pointed at this repository.
- Validate that shared assets still layer cleanly with project-local `.opencode/` overlays after the move.
- Record the `.opencode/` symlink approach only as an evaluated but rejected alternative, not as a supported implementation path.

## Capabilities

### New Capabilities

- `local-opencode-mise-workflow`: Define the supported local launcher workflow for running OpenCode against this repository through `mise` tasks.

### Modified Capabilities

- `shared-opencode-config`: Change the shared-kit structure and loading expectations so the repository root is the canonical shared config directory and layering validation covers the moved asset locations.

## Impact

- Affects repository layout for shared OpenCode assets under the workspace root.
- Affects local developer workflow documentation and `mise` task definitions.
- Affects any bootstrap or validation logic that currently assumes shared assets live under `.opencode/`.
- Requires explicit validation that root-level shared assets still coexist with project-local `.opencode/` overlays when loaded through `OPENCODE_CONFIG_DIR`.
