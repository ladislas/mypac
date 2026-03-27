## Context

The shared OpenCode kit bootstrap established `pac-` as the canonical namespace for shared reusable assets, but it deliberately left the existing OpenSpec command filenames at `/opsx-*` to minimize churn. That compromise no longer pulls its weight: the command namespace is generic, it can collide with repositories using OpenSpec directly, and the exception now creates drift between shared command names, shared skill names, and the documentation that explains how the kit is supposed to be used.

This change affects the shared command surface, the supporting skill instructions that refer to those commands, and the local playbooks that describe the workflow. It also needs to preserve the layered model where the shared kit is loaded through `OPENCODE_CONFIG_DIR` and project-local `.opencode/` assets remain additive.

## Goals / Non-Goals

**Goals:**

- Make `/pac-*` the canonical user-facing namespace for shared OpenSpec workflow commands.
- Remove stale `/opsx-*` references across shared commands, shared skills, and local documentation in one coordinated pass.
- Update the shared-kit compatibility rules so commands and skills follow the same namespacing story wherever OpenCode binds visible names directly from filenames.
- Validate that the renamed shared commands remain discoverable and non-colliding when loaded alongside project-local OpenCode assets.

**Non-Goals:**

- Reorganize the shared kit into new top-level directories or introduce symlink-based layouts.
- Change the primary shared agent names.
- Expand the shared kit with unrelated new commands or skills.
- Solve broader runner ergonomics, `mise` integration, or multi-profile loading in this change.

## Decisions

### Decision: Rename shared OpenSpec command filenames to `pac-*`

The shared workflow commands will be renamed at the filename level so their runtime-visible names become `/pac-propose`, `/pac-explore`, `/pac-apply`, and `/pac-archive`. OpenCode derives command identity from filenames, so a real namespace change requires a real filename change rather than an internal metadata tweak.

**Alternatives considered:**

- **Keep `/opsx-*` as-is:** rejected because it preserves the collision risk that triggered the change.
- **Add `/pac-*` aliases but keep `/opsx-*` indefinitely:** rejected because it keeps the generic namespace alive and weakens the point of the rename.
- **Invent a more verbose prefix:** rejected because `pac-` already exists as the shared kit namespace and is short enough to use comfortably.

### Decision: Treat command, skill, and documentation references as one migration unit

The rename will update command files, shared skill prompts, and repository documentation together. The command surface is part of the workflow contract, so leaving instructions or examples on the old names would create fake compatibility and user confusion.

**Alternatives considered:**

- **Rename commands first and clean up docs later:** rejected because it creates an avoidable broken intermediate state.
- **Only change documentation while leaving filenames alone:** rejected because it does not solve the actual runtime collision problem.

### Decision: Narrow the bootstrap compatibility exception to agents only

The bootstrap rule that preserved runtime-visible names for filename-bound assets will be refined. Shared commands will now follow the `pac-` namespace directly, while shared agents may still keep their established names (`RickBuild`, `RickPlan`) because this change is specifically about the command namespace and there is no comparable collision pressure on the agent names today.

**Alternatives considered:**

- **Remove all runtime-visible exceptions, including agents:** rejected because that would expand scope and force unrelated churn.
- **Keep commands as a documented exception forever:** rejected because the exception has become more confusing than useful.

### Decision: Validate coexistence through discovery-oriented checks, not a compatibility shim

Validation will focus on OpenCode discovery and layering behavior after the rename: the shared kit loaded through `OPENCODE_CONFIG_DIR`, local repo assets still present, and the resolved command set showing distinct `/pac-*` shared commands without relying on duplicate `/opsx-*` compatibility commands.

**Alternatives considered:**

- **Ship a temporary compatibility shim with duplicate commands:** rejected because duplicate command names are exactly the ambiguity this change is meant to avoid.
- **Skip validation and rely on file review only:** rejected because discovery behavior is the runtime concern, not just file naming.

## Risks / Trade-offs

- **Users with muscle memory for `/opsx-*` will hit a short migration bump** → Mitigation: update all in-repo guidance in the same change and call out the rename clearly in review/commit messaging.
- **A stale reference may survive in a skill or playbook** → Mitigation: search for `opsx-` across commands, skills, docs, and OpenSpec artifacts as part of implementation.
- **Validation may miss a repository-specific overlay edge case** → Mitigation: re-run the shared-kit layering checks in the known sibling validation repo and verify the resolved command set explicitly.

## Migration Plan

1. Rename the shared command files from `opsx-*` to `pac-*`.
2. Update shared skill instructions and repository playbooks to point only to the renamed commands.
3. Update the shared OpenSpec spec and design-facing documentation to reflect that commands are no longer a bootstrap exception.
4. Re-run shared-kit validation checks to confirm `/pac-*` commands are discoverable alongside local overlays and no stale `/opsx-*` references remain in active workflow docs.

## Open Questions

- Should implementation leave behind any short-lived human-facing migration note for `/opsx-*`, or is the coordinated rename plus updated docs enough?
