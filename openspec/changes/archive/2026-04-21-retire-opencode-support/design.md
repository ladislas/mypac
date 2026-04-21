## Context

The repository already has working Pi prompts, extensions, and package metadata, and Pi is now the interface used in practice for day-to-day work. What remains is mostly migration residue from the earlier dual-stack plan: OpenCode launch/config files, OpenCode-only validation, OpenCode-oriented docs, and a few assets whose only remaining value is as reference material.

This change cuts across docs, package metadata, launcher tasks, runtime integration, and shared assets, so it benefits from an explicit design to keep the removal deliberate rather than ad hoc. The user also wants a clean cut instead of a long deprecation period, while treating broader OpenSpec spec archaeology as a separate, collaborative follow-up.

## Goals / Non-Goals

**Goals:**

- Make Pi the only supported interface story in active repository docs and metadata.
- Remove OpenCode runtime/config/task/dependency surface that no longer reflects actual usage.
- Preserve Rick persona content as future-work context without keeping inactive runtime files in the active repo surface.
- Review legacy command assets and keep only workflows still worth carrying forward in Pi.
- Reduce stale, low-value documentation when it is no longer helping day-to-day use.

**Non-Goals:**

- Designing a full Pi-native persona system in this change.
- Preserving OpenCode compatibility behind a soft deprecation path.
- Exhaustively rewriting all historical OpenSpec artifacts in the same pass.
- Reintroducing abstract strategy documentation that is not needed for the current Pi + OpenAI setup.

## Decisions

### Decision: Remove OpenCode support outright rather than keep a compatibility layer

The repository will treat OpenCode as retired, not as a secondary supported interface. That means removing OpenCode runtime entrypoints (`opencode.json`, `mise run opencode`, validation tasks, plugin wiring, dependency usage) instead of leaving them in place as undocumented compatibility baggage.

- Alternative considered: keep a dormant compatibility path. Rejected because actual usage is already Pi-only, so dormant support would mostly preserve maintenance overhead and ambiguity.

### Decision: Use the README as the primary active setup/source-of-truth document

Pi setup and supported workflow guidance will live primarily in `README.md`, not in a growing tree of setup, ADR, or strategy documents. Additional docs should exist only when they add practical day-to-day value.

- Alternative considered: replace OpenCode docs with a dedicated Pi setup doc. Rejected for now because the current need is to simplify, not to move the same content into another file.

### Decision: Preserve Rick persona material in a GitHub issue, not in active runtime files

The current Rick agent files will be converted into future-work context by opening a GitHub issue containing their content and explaining that Pi-native persona support may return later. After that, the files can be removed from the active repository surface.

- Alternative considered: move the files into a dormant `personas/` directory. Rejected because unused runtime-adjacent files would still create noise and imply partial support.

### Decision: Port only workflows that still earn their keep

Existing OpenCode command assets will be reviewed one by one. Workflows that still matter in Pi will be ported or re-expressed in the Pi-native setup; the rest will be removed rather than migrated by default.

- Alternative considered: port every existing command for parity. Rejected because the goal is simplification, not preserving old surface area for its own sake.

### Decision: Keep OpenSpec planning, but defer broader spec/history cleanup

This change will create only the minimal OpenSpec delta needed to track the retirement work. Broader cleanup of current-vs-historical OpenSpec specs and archived rationale will be handled in a separate, human-guided pass.

- Alternative considered: fully reconcile all OpenSpec specs during this change. Rejected because it mixes runtime retirement with repository archaeology and increases the chance of accidental history rewriting.

## Risks / Trade-offs

- [Useful OpenCode-only behavior is removed before a Pi replacement exists] → Mitigate by reviewing commands explicitly and porting only the workflows still used.
- [Important persona content is lost during cleanup] → Mitigate by creating the GitHub issue before deleting the Rick agent files.
- [Docs become too sparse after pruning] → Mitigate by making the README complete enough for real setup/use before removing secondary docs.
- [OpenSpec current specs still describe the old OpenCode world after this change lands] → Mitigate by treating that cleanup as an explicit follow-up instead of pretending it is solved implicitly.

## Migration Plan

1. Update the active documentation story so README clearly states the Pi-only workflow and stops routing readers through stale OpenCode-era docs.
2. Remove OpenCode runtime/config/task/dependency pieces.
3. Audit shared assets: port useful command workflows, create the Rick persona follow-up issue, then remove inactive OpenCode agent/plugin assets.
4. Verify the remaining package metadata and file layout match the Pi-only repository surface.

## Open Questions

- Which existing command workflows are still worth keeping in Pi after review?
- Which stale docs should be removed entirely versus simplified into the README?
- Should any Pi-native persona mechanism eventually exist, or is the Rick material purely archival inspiration for now?
