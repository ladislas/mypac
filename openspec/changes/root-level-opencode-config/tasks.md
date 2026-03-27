## 1. Restructure shared OpenCode assets

- [x] 1.1 Move the canonical shared `agents/`, `commands/`, and `skills/` directories from `.opencode/` to the repository root.
- [x] 1.2 Update any in-repo references, bootstrap wiring, and documentation that still point at `.opencode/` as the shared asset source.

## 2. Add the supported local launcher workflow

- [x] 2.1 Add `mise` task definitions for `mise run opencode` and any approved companion launcher tasks that run OpenCode with `OPENCODE_CONFIG_DIR` set to the repository root.
- [x] 2.2 Update local workflow documentation so the `mise run` path is the supported day-to-day workflow and direct shell exports are framed only as compatibility context.

## 3. Validate compatibility and layering

- [x] 3.1 Add or update validation coverage that proves repository-root `OPENCODE_CONFIG_DIR` loading still discovers the shared agents, commands, and skills.
- [x] 3.2 Add or update validation coverage that proves the moved shared kit still layers additively with project-local `.opencode/` assets.
- [x] 3.3 Document the `.opencode/` symlink idea as a rejected alternative rather than a supported implementation path.
