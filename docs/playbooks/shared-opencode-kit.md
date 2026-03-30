# Shared OpenCode Kit

## Goal

Treat this repository as a reusable OpenCode kit that can be loaded from other repositories through `OPENCODE_CONFIG_DIR` while still allowing project-local `.opencode/` additions.

## Shared Kit Root

- The shared kit root is this repository itself.
- Shared reusable assets live here:
  - `agents/`
  - `commands/`
  - `plugins/`
  - `skills/`
- To load the shared kit from another repository, point `OPENCODE_CONFIG_DIR` at the repository root.

```bash
export OPENCODE_CONFIG_DIR=/path/to/mypac
```

For local work in this repository, the supported launcher is:

```bash
mise run opencode
```

Manual shell exports remain useful as compatibility context, but they are not the primary documented workflow for this repo.

## Shared Runtime Plugin Wiring

- This repository's shared OpenCode runtime wiring lives at the repository root so it loads with the rest of the shared kit through `OPENCODE_CONFIG_DIR=/path/to/mypac`.
- The shared config entrypoint is `opencode.json` at the repository root.
- The shared runtime-awareness plugin implementation now lives in `plugins/agent-runtime-awareness/`, and the shared kit loads it explicitly from `opencode.json` using a relative plugin path.
- The runtime-awareness plugin implementation in `plugins/agent-runtime-awareness/` enforces the shared agent boundary: `RickBuild` keeps normal implementation access, while non-build agents such as `RickPlan` stay read-only and are limited to analysis shell workflows.
- Shared plugin dependencies belong in the repository-root `package.json`.
- If a consuming repository adds its own local overlay plugins under `.opencode/plugins/`, keep any overlay-only dependencies with that overlay configuration.

## Layering Model

- The shared kit provides the reusable baseline.
- A target repository may still define its own local `.opencode/agents/`, `.opencode/commands/`, `.opencode/plugins/`, and `.opencode/skills/`.
- Project-local assets are additive overlays. Do not copy the shared kit into each project.
- If a project should not use the shared kit, run OpenCode without `OPENCODE_CONFIG_DIR` set.

## Canonical Naming Rule

- `pac-` is the reserved canonical namespace for shared reusable assets.
- Use `pac-` when the asset type supports a distinct canonical identifier without harming the runtime interface.
- Shared commands now use the same canonical namespace directly.

## Bootstrap Compatibility Mapping

OpenCode derives some visible names directly from filenames, so the shared kit uses canonical filenames where the runtime name should be shared and reserves bootstrap compatibility exceptions only for primary agents.

| Asset type | Bootstrap canonical rule | Visible/runtime name |
| --- | --- | --- |
| Skills | Use `pac-...` for shared canonical skill names | Same as canonical skill name |
| Commands | Use `pac-...` shared command filenames directly | `/pac-*` is the user-facing command set |
| Agents | Keep existing shared agent filenames as the bootstrap compatibility exception | `RickBuild` and `RickPlan` remain the primary agent names |

This means the repository treats `pac-` as the canonical shared namespace for reusable commands and skills, while agents remain the only bootstrap compatibility exception.

## Initial Bootstrap Asset Set

- Shared primary agents: `RickBuild`, `RickPlan`
- Shared OpenSpec commands: `/pac-propose`, `/pac-explore`, `/pac-apply`, `/pac-archive`
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

The shared-kit layering model is validated with `mise run validate`, which covers both root-level discovery and additive project-local overlays.

The most recent manual spot-check was in the sibling repository `../opencode-setup` with:

- Shared kit loaded from `OPENCODE_CONFIG_DIR=/Users/ladislas/dev/ladislas/mypac`
- Local overlay assets defined in `../opencode-setup/.opencode/`

Validated observations:

- `opencode agent list` exposed shared agents `RickBuild` and `RickPlan` alongside the local overlay agent `LocalOverlay`
- `opencode debug skill` exposed shared skills `pac-openspec-*` and `pac-bootstrap-placeholder` alongside the local `local-overlay-skill`
- `opencode debug config` showed both shared `/pac-*` commands and the local `local-overlay` command in the resolved configuration

This confirms the shared kit works as an additive layer without copying shared assets into the target repository.

## OpenCode-Only Compatibility Review

- The shared kit uses root-level OpenCode-native `agents/`, `commands/`, `plugins/`, and `skills/` locations as the primary source of truth.
- The shared runtime-awareness plugin also lives under the root-level `plugins/` directory so `OPENCODE_CONFIG_DIR` loads it with the rest of the shared kit.
- The initial canonical shared skill set avoids imported external catalogs and keeps the bootstrap intentionally small.
- The bootstrap preserves existing runtime-visible names only for shared primary agents where OpenCode derives them from filenames.
- No additional `.claude/`, `.cursor/`, or other vendor-specific compatibility structures were added as part of the bootstrap.

## Rejected Alternative: `.opencode/` Symlinks

- Creating `.opencode/agents`, `.opencode/commands`, or `.opencode/skills` symlinks back to the root-level shared directories is not a supported setup.
- It adds filesystem-specific behavior, muddies the source-of-truth story, and makes discovery harder rather than easier.
- Keep the shared kit at the repository root and reserve `.opencode/` for project-local overlays.
