## Context

This repository already contains a working OpenCode setup with custom primary agents (`RickPlan`, `RickBuild`), OpenSpec commands, and OpenSpec support skills. The next step is not to import every external workflow immediately, but to reshape the repository into a reusable personal OpenCode kit that can be shared across repositories while still allowing project-local `.opencode/` overlays.

The design needs to preserve the current human-in-the-loop workflow, keep OpenCode as the only runtime target, and avoid inventing a separate packaging system before the basic layering model has been proven in practice.

## Goals / Non-Goals

**Goals:**

- Define a canonical structure for this repository as a reusable OpenCode configuration kit.
- Establish a shared naming convention that avoids collisions between shared and project-local assets.
- Keep the initial implementation intentionally small by reusing existing agents, commands, and OpenSpec skills first.
- Support a layered model where shared config can be loaded globally or via a custom config directory, while project `.opencode/` content can add local behavior.

**Non-Goals:**

- Import the full catalog of external skills and commands in the first pass.
- Build autonomous multi-agent orchestration.
- Add gitagent as a required runtime or dependency management layer.
- Solve multiple user profiles or environment profiles in the first iteration.

## Decisions

### Decision: Treat the repository as a shared OpenCode kit, not a generic agent framework

The repository will be designed around OpenCode's native configuration model: a shared config directory loaded through `OPENCODE_CONFIG_DIR` plus project-local `.opencode/` overlays. This keeps the bootstrap opt-in and easy to disable while avoiding an extra abstraction layer before the OpenCode-specific workflow is validated.

**Alternatives considered:**

- **Use gitagent as the primary composition system now:** rejected because the current need is OpenCode-only and the extra abstraction would add ceremony before the basic structure is proven.
- **Copy shared assets into every target repository:** rejected because it creates drift and turns reuse into a manual synchronization problem.
- **Install the full shared kit as always-on global config:** deferred because `OPENCODE_CONFIG_DIR` gives a cleaner bootstrap path with easier opt-out behavior for repositories that should not inherit the full personal workflow.

### Decision: Use a rich shared layer with a small bootstrap asset set

The shared kit will be opinionated because it represents the user's personal workflow, but the first implementation will include only existing repo assets and minimal placeholders needed to test the structure. This keeps the bootstrap focused on architecture rather than content migration.

**Alternatives considered:**

- **Start with a minimal shared layer:** rejected because the point of the repository is to carry a real personal workflow, not an empty shell.
- **Import all desired external skills immediately:** rejected because imported content must be reviewed and adapted for OpenCode, and that review should happen after the layering model works.

### Decision: Use the `pac-` namespace for shared assets

Shared agents, skills, and commands will use a common `pac-` namespace in their canonical identifiers. This avoids collisions with built-in OpenCode assets, team-local assets, and future project-specific additions while keeping the naming scheme simple and filesystem-safe.

**Alternatives considered:**

- **Use punctuation-based namespaces like `pac:` or `pac+`:** rejected because skill names must use kebab-case and punctuation increases portability and tooling risk.
- **Use an author-based prefix like `lad-` or `ldt-`:** rejected for now because `pac-` better matches the repository's role as a personal AI config kit rather than a purely personal initials namespace.

### Decision: Canonical identifiers may differ from visible labels when the runtime supports it

Shared assets will use `pac-` in canonical identifiers where OpenCode provides a distinct internal identifier, most notably shared skill names. For assets whose runtime-visible name is derived directly from the filename, the bootstrap may preserve established compatibility names when renaming would create unnecessary churn or break the intended interface. In this bootstrap, that means the primary agents remain `RickBuild` and `RickPlan`, and the existing OpenSpec workflow commands remain `opsx-*`.

**Alternatives considered:**

- **Use unprefixed visible and internal names everywhere:** rejected because it reintroduces collision risk for assets that do support canonical internal naming.
- **Force every visible label to include the full canonical prefix:** rejected for bootstrap because OpenCode derives command and agent names from filenames, so renaming working assets would create avoidable churn.

### Decision: Shared assets remain reusable, project-local assets remain additive

The shared kit will own canonical reusable assets. Project repositories may load that kit via `OPENCODE_CONFIG_DIR` and add local `.opencode/agents`, `.opencode/commands`, and `.opencode/skills`, but they should not duplicate the same shared skill names. Local specialization should use distinct names or project instructions rather than same-name duplicates.

**Alternatives considered:**

- **Allow duplicate names and rely on discovery order:** rejected because skill discovery expects unique names and duplicate names create ambiguous behavior.
- **Force every project to use only shared assets:** rejected because local adaptation is part of the intended workflow.

### Decision: Implementation should be committed in atomic task-group commits

Implementation will be delivered in small, coherent commits aligned to the numbered task groups in `tasks.md`. Each group should be completed and verified before creating its commit so the change history remains reviewable and rollback-friendly.

**Alternatives considered:**

- **One commit at the end of the whole change:** rejected because it hides architectural checkpoints and makes review harder.
- **One commit for every tiny subtask:** rejected because it creates noisy history without adding useful review boundaries.

### Decision: Bootstrap implementation should prefer minimal structural change

The bootstrap implementation should make the smallest structural changes needed to prove the shared-kit architecture works. Existing working agents, commands, and skills should be preserved where possible rather than being renamed, moved, or generalized beyond what the bootstrap requires. The repository's existing `.opencode/` directory will serve as the shared kit root for `OPENCODE_CONFIG_DIR`, so bootstrap does not need a parallel top-level `agents/`, `commands/`, or `skills/` tree.

**Alternatives considered:**

- **Restructure the repository aggressively during bootstrap:** rejected because it increases risk, obscures validation, and makes it harder to tell whether the architecture or the refactor caused problems.
- **Freeze all structural changes entirely:** rejected because some structural change is required to validate reuse and namespacing.

## Risks / Trade-offs

- **Rich shared config may feel too ambient in some repositories** → Mitigation: keep the shared layer reusable but allow opting out or relying more heavily on project-local config for team repositories.
- **Namespacing everything may make identifiers slightly longer** → Mitigation: prefer a short prefix (`pac-`) and apply it consistently rather than debugging collisions later.
- **Imported external skills may still contain Claude- or framework-specific assumptions** → Mitigation: postpone most imports and require explicit OpenCode review before promoting them into the shared kit.
- **The repository may still need refactoring once real reuse starts across projects** → Mitigation: keep the bootstrap focused on structure and placeholders so future migration cost stays low.

## Migration Plan

1. Keep the current OpenCode setup working while introducing the shared-kit structure, `pac-` naming convention, and `OPENCODE_CONFIG_DIR` loading model.
2. Promote the existing in-repo agents, commands, and OpenSpec skills into the canonical bootstrap set.
3. Add only the minimum placeholder assets needed to validate the layered architecture.
4. Test the shared kit in at least one other repository by loading it through `OPENCODE_CONFIG_DIR` alongside project-local `.opencode/` additions before importing a larger skill catalog.

## Open Questions

- Which assets should remain always-on in the shared layer versus merely available for on-demand skill loading?
