## Context

The repository keeps OpenSpec history under `openspec/changes/archive/`. That history is useful when it preserves rationale for current workflow decisions, but archived change files are still plain repository content that can be surfaced as agent context. Some older archived changes positively describe unsupported behavior such as `/add-task`, delegated `/pac-apply` execution, or retired OpenCode-specific workflow. Those entries now have more context risk than historical value.

## Goals / Non-Goals

**Goals:**

- Define a simple rule for deciding which archived OpenSpec changes are still safe to keep.
- Remove archived change trails whose main value is outweighed by stale or misleading instructions.
- Keep enough archive history to preserve useful rationale for current supported workflow.

**Non-Goals:**

- Rebuild the OpenSpec archive structure or add a new archival format.
- Delete all old OpenSpec history indiscriminately.
- Add runtime filtering or tooling that hides archived changes from the agent.

## Decisions

### Review archived changes for context safety, not just historical age

- Decision: classify archived change trails by whether they reinforce current supported behavior, clearly document removals, or instead restate obsolete behavior as if it were active.
- Rationale: the issue is stale context, not old timestamps by themselves.
- Alternative considered: delete all older archived changes. Rejected because it would throw away useful rationale that still matches the current repository.

### Remove archived changes that positively describe unsupported workflows

- Decision: delete archived change trails whose primary content is unsupported behavior such as retired OpenCode integration, unimplemented `/add-task` workflow, or delegated `/pac-apply` execution that no longer matches the runtime.
- Rationale: these are the most likely to mislead the agent when surfaced out of their historical context.
- Alternative considered: keep them and rely on newer cleanup changes to contradict them. Rejected because generic repository context search may still surface the obsolete guidance first.

### Keep archives that remain aligned with current workflow or clearly document removals

- Decision: retain archived changes that still match supported behavior or that primarily remove/retire obsolete behavior without reintroducing it as active guidance.
- Rationale: they still provide useful archaeology without strongly pulling the agent toward stale implementation advice.
- Alternative considered: move all unsafe history outside the repository. Rejected as unnecessary for this cleanup.

### Document the retention rule in active workflow guidance

- Decision: update active OpenSpec workflow guidance to say archive retention is conditional on context safety and usefulness.
- Rationale: this gives future cleanups an explicit rule instead of relying on one-off judgment.

## Risks / Trade-offs

- [Useful historical rationale could be removed] → Mitigation: remove only changes whose primary content is unsupported behavior and keep changes that explain removals or still-current workflow.
- [Some stale archive entries could remain after the first pass] → Mitigation: verify with targeted searches for known unsupported topics after cleanup.
- [The rule depends on human judgment] → Mitigation: keep the guidance simple and tie it to whether archived content is safe and useful as repository context.
