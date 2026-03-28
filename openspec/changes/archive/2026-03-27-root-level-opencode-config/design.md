## Context

The repository already acts as a shared OpenCode kit, but its canonical assets currently live under `.opencode/`, so the supported `OPENCODE_CONFIG_DIR` target points at an implementation-specific subdirectory instead of the repository itself. Issue #16 narrows the desired outcome to a root-level shared kit layout plus a first-class `mise run` workflow for local use, while keeping the layering model intact when other repositories combine this kit with their own `.opencode/` overlays.

This change touches structure, developer ergonomics, and compatibility expectations at the same time. The implementation therefore needs an explicit design that separates the supported path (root-level directories plus `mise` launchers) from the rejected alternative (symlinking `.opencode/` back to root-level directories).

## Goals / Non-Goals

**Goals:**

- Make `agents/`, `commands/`, and `skills/` at the repository root the canonical shared OpenCode asset locations.
- Make the repository root the supported `OPENCODE_CONFIG_DIR` target for both local use and cross-repository consumption.
- Provide a clear local developer entrypoint through `mise run opencode` and any closely related helper tasks needed for the same workflow.
- Preserve and validate additive layering with repository-local `.opencode/` assets after the move.
- Document why the symlink-based `.opencode/` approach is not the supported workflow.

**Non-Goals:**

- Supporting both root-level and `.opencode/`-based local workflows indefinitely.
- Implementing `.opencode/` symlinks as part of the accepted architecture.
- Expanding the shared kit beyond the current agents, commands, and skills covered by the repository.
- Introducing a new configuration transport beyond `OPENCODE_CONFIG_DIR` and `mise` task wrappers.

## Decisions

### Decision: Repository root becomes the canonical shared config directory

The shared kit will move its human-edited asset directories to root-level `agents/`, `commands/`, and `skills/`, and documentation will treat the repository root as the canonical `OPENCODE_CONFIG_DIR` value. This matches the desired ergonomics from the issue, removes the need to explain why consumers should target a hidden subdirectory, and makes the shared kit structure obvious to contributors.

Alternative considered: keep `.opencode/` as the canonical layout and only improve documentation. Rejected because it preserves the discoverability problem and keeps the workflow centered on an internal implementation detail.

### Decision: `mise run` is the only supported local launcher workflow

Local usage will be standardized around `mise run opencode` and any companion tasks that wrap the same root-targeted `OPENCODE_CONFIG_DIR` behavior. This keeps the workflow explicit, easy to teach, and easy to change in one place if local launch details evolve.

Alternative considered: continue documenting direct ad hoc shell exports as an equally supported local workflow. Rejected because the clarified direction is to keep only the `mise run` approach as the supported local path, while direct `OPENCODE_CONFIG_DIR` use remains a compatibility mechanism rather than the documented day-to-day workflow.

### Decision: Symlinked `.opencode/` directories are documented as a rejected alternative

The design will mention `.opencode/` symlinks only in the rationale as an evaluated alternative. They are not part of the accepted implementation because they reintroduce a split mental model, depend on symlink behavior for discovery and watching, and add filesystem-specific complexity without improving the supported `mise`-based workflow.

Alternative considered: create `.opencode/agents`, `.opencode/commands`, and `.opencode/skills` symlinks pointing to root-level directories. Rejected because the user explicitly narrowed the supported workflow to the `mise run` approach and because symlinked discovery adds extra behavior to validate.

### Decision: Layering validation remains mandatory after the move

The change will include explicit validation of the layering model so moving the shared directories does not regress coexistence with project-local `.opencode/` assets. Validation can be done through tests, documented verification steps, or both, but it must cover root-level shared loading plus additive local overlays.

Alternative considered: rely on the structural move alone and assume layering still works. Rejected because the issue explicitly calls for validating the layering model after the refactor.

## Risks / Trade-offs

- Root-level directories are more visible and easier to edit, but they also make the repository layout more opinionated -> mitigate with clear docs that explain these directories are the canonical shared kit.
- Standardizing on `mise run` simplifies the local workflow, but contributors without `mise` need a fallback understanding -> mitigate by documenting direct `OPENCODE_CONFIG_DIR` usage as compatibility context, not as the supported local workflow.
- Moving assets can break existing references, scripts, or docs that assume `.opencode/` paths -> mitigate by auditing repository references as part of implementation.
- Layering validation may require lightweight harness changes or extra verification steps -> mitigate by planning validation work as a first-class task rather than a follow-up.

## Migration Plan

1. Move canonical shared asset directories from `.opencode/` to the repository root.
2. Update any repository references, bootstrap wiring, and workflow docs to use the new root-level layout.
3. Add `mise` tasks that launch OpenCode against the repository root and document them as the supported local workflow.
4. Validate that the shared kit still loads correctly via repository-root `OPENCODE_CONFIG_DIR` and still layers additively with project-local `.opencode/` assets.
5. Remove or rewrite stale `.opencode/`-centric guidance so the supported path is unambiguous.

## Open Questions

- Which companion `mise` tasks beyond `mise run opencode` are worth keeping once the workflow is narrowed, and do they all need to ship in this change?
- What is the lightest reliable way to validate layering in automation without introducing fragile environment-specific test setup?
