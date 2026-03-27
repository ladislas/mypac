# Shared OpenCode Kit

## Goal

Treat this repository as a reusable OpenCode kit that can be loaded from other repositories through `OPENCODE_CONFIG_DIR` while still allowing project-local `.opencode/` additions.

## Shared Kit Root

- The shared kit root is this repository's `.opencode/` directory.
- Shared reusable assets live here:
  - `.opencode/agents/`
  - `.opencode/commands/`
  - `.opencode/skills/`
- To load the shared kit from another repository, point `OPENCODE_CONFIG_DIR` at this directory, not at the repository root.

```bash
export OPENCODE_CONFIG_DIR=/path/to/mypac/.opencode
```

## Layering Model

- The shared kit provides the reusable baseline.
- A target repository may still define its own local `.opencode/agents/`, `.opencode/commands/`, and `.opencode/skills/`.
- Project-local assets are additive overlays. Do not copy the shared kit into each project.
- If a project should not use the shared kit, run OpenCode without `OPENCODE_CONFIG_DIR` set.

## Canonical Naming Rule

- `pac-` is the reserved canonical namespace for shared reusable assets.
- Use `pac-` when the asset type supports a distinct canonical identifier without harming the runtime interface.
- In the bootstrap, that applies most cleanly to shared skills.

## Bootstrap Compatibility Mapping

OpenCode derives some visible names directly from filenames, so the bootstrap keeps the smallest possible diff instead of renaming working assets just to satisfy a naming ideal.

| Asset type | Bootstrap canonical rule | Visible/runtime name |
| --- | --- | --- |
| Skills | Use `pac-...` for new shared canonical skill names | Same as canonical skill name |
| Commands | Keep existing shared OpenSpec command filenames during bootstrap | `/opsx-*` remains the user-facing command set |
| Agents | Keep existing shared agent filenames during bootstrap | `RickBuild` and `RickPlan` remain the primary agent names |

This means the repository treats `pac-` as the canonical shared namespace, but the bootstrap intentionally preserves established command and agent names where OpenCode binds the visible identifier to the filename.

## Initial Bootstrap Asset Set

- Shared primary agents: `RickBuild`, `RickPlan`
- Shared OpenSpec commands: `/opsx-propose`, `/opsx-explore`, `/opsx-apply`, `/opsx-archive`
- Canonical shared OpenSpec skills:
  - `pac-openspec-propose`
  - `pac-openspec-explore`
  - `pac-openspec-apply-change`
  - `pac-openspec-archive-change`
- Minimal placeholder shared skill:
  - `pac-bootstrap-placeholder`

## Skill Collision Rule

- Shared skill names are canonical and must stay unique.
- Project-local specializations must use distinct names instead of redefining the same shared skill name.
- If a project needs specialized behavior, create a new local skill name or encode the specialization in project instructions.

## Layering Validation Snapshot

The bootstrap layering model was validated in the sibling repository `../opencode-setup` with:

- Shared kit loaded from `OPENCODE_CONFIG_DIR=/Users/ladislas/dev/ladislas/mypac/.opencode`
- Local overlay assets defined in `../opencode-setup/.opencode/`

Validated observations:

- `opencode agent list` exposed shared agents `RickBuild` and `RickPlan` alongside the local overlay agent `LocalOverlay`
- `opencode debug skill` exposed shared skills `pac-openspec-*` and `pac-bootstrap-placeholder` alongside the local `local-overlay-skill`
- `opencode debug config` showed both shared `/opsx-*` commands and the local `local-overlay` command in the resolved configuration

This confirms the shared kit works as an additive layer without copying shared assets into the target repository.

## OpenCode-Only Compatibility Review

- The bootstrap set uses OpenCode-native `.opencode/agents/`, `.opencode/commands/`, and `.opencode/skills/` locations as the primary source of truth.
- The initial canonical shared skill set avoids imported external catalogs and keeps the bootstrap intentionally small.
- The bootstrap preserves existing runtime-visible command and agent names only where OpenCode derives them from filenames.
- No additional `.claude/`, `.cursor/`, or other vendor-specific compatibility structures were added as part of the bootstrap.

## Minimal Structural Change Rule

- Reuse the existing `.opencode/` structure as the shared kit.
- Prefer documenting and validating the layering model over large-scale renames.
- Add only the smallest placeholder assets needed to prove the structure before importing a broader catalog.
