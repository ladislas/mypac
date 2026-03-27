## Why

The bootstrap shared OpenCode kit intentionally preserved the existing `/opsx-*` command names, but real usage exposed that the namespace is too generic and can collide with repositories that use OpenSpec directly. This change is needed now to make the shared kit's command surface clearly `mypac`-owned before more repositories and docs depend on the old names.

## What Changes

- Rename the shared OpenSpec workflow commands from `/opsx-*` to `/pac-*` as the canonical user-facing command set.
- Review command filenames, command references, skill instructions, and supporting docs together so the rename does not leave stale `opsx-*` references behind.
- Revisit the bootstrap compatibility rules so shared commands follow the same `pac-` namespacing intent already used for canonical shared identifiers where practical.
- Document how the renamed shared commands coexist with repositories that also define their own OpenSpec commands and verify expected discovery/loading behavior after the rename.
- Keep unrelated structural work, root-level moves, symlink layouts, and `mise` runner ergonomics out of scope for this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shared-opencode-config`: Change the shared command namespace, compatibility guidance, and repository-level workflow/documentation expectations for the reusable OpenCode kit.

## Impact

- `.opencode/commands/` shared OpenSpec command files and any command cross-references.
- `.opencode/skills/` instructions that currently point users at `/opsx-*` commands.
- Documentation in `docs/playbooks/` and any examples that describe the shared kit workflow.
- Validation steps for shared-kit loading, command discovery, and collision behavior when combined with repo-local OpenCode assets.
