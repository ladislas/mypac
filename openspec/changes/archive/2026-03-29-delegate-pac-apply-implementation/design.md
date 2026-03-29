## Context

`/pac-apply` and the matching apply skill currently describe implementation as if the main agent performs the work directly after reading the OpenSpec artifacts. For this phase, the repository needs a tighter execution contract: the main agent remains the orchestrator, but concrete implementation work is handed off in small slices to the general subagent. The scope is intentionally narrow and documentation-driven, covering only `/pac-apply`, its skill guidance, and the workflow contract they rely on.

## Goals / Non-Goals

**Goals:**

- Define a phase 1 `/pac-apply` loop where the main agent reads context, selects the next task or small coherent batch, and delegates execution to the general subagent.
- Preserve human-in-the-loop control by keeping planning, review, continuation, and blocker handling in the main agent context.
- Use actual harness terminology for delegation rather than invented syntax.
- Keep existing atomic commit guidance intact while clarifying where it fits in the delegated flow.

**Non-Goals:**

- Adding interactive task-group selection UX such as All/Stop or a group picker.
- Delegating the entire change to an autonomous subagent in one shot.
- Redesigning unrelated OpenSpec commands, schemas, or repository workflows.
- Changing application runtime code or adding new tooling in this phase.

## Decisions

### Decision: `/pac-apply` becomes an orchestrator, not the direct implementer

The main agent will continue to select the change, read apply context, determine the next task or small coherent batch, and decide whether work can proceed. It will not treat delegation as a handoff of the whole change. Instead, each iteration delegates only the currently selected implementation slice.

**Alternatives considered:**

- **Keep implementation entirely in the main agent context:** rejected because this phase exists specifically to move execution into a delegated subagent flow.
- **Delegate the entire remaining task list at once:** rejected because it weakens review boundaries and conflicts with the repository's human-guided workflow.

### Decision: Delegation uses real Task/general-subagent wording

The command and skill guidance will describe delegation using the actual harness concept of invoking the Task tool with `subagent: general`. This keeps the docs aligned with real execution primitives and avoids pseudo-syntax such as `@general` that does not match the environment.

**Alternatives considered:**

- **Describe delegation abstractly without naming the harness primitive:** rejected because it leaves too much room for inconsistent implementation.
- **Use conversational shorthand like `@general`:** rejected because it is not the actual tool contract.

### Decision: Review, task-state updates, and pause decisions stay with the main agent

After each delegated implementation slice completes, the main agent reviews the result, decides whether it satisfies the requested slice, updates `tasks.md` when appropriate, and either continues or pauses on blockers. This preserves the existing human-in-the-loop model even though code-editing work is delegated.

**Alternatives considered:**

- **Let the subagent run the full loop including progress bookkeeping:** rejected because it blurs orchestration and execution responsibilities.
- **Require the subagent to decide when to continue to the next unrelated slice:** rejected because it would create broader autonomy than this phase allows.

### Decision: Atomic commit guidance remains unchanged, but is applied after delegated review

The change will keep the repository's current atomic commit expectations. The delegated execution model only changes who performs the scoped implementation work; it does not replace the rule that commits happen at meaningful task-group boundaries with matching `tasks.md` updates.

**Alternatives considered:**

- **Move commit responsibility fully into the delegated execution description:** rejected because it adds workflow change beyond the narrow phase 1 scope.
- **Remove commit guidance from `/pac-apply` while introducing delegation:** rejected because it would silently weaken an existing repository rule.

## Risks / Trade-offs

- **Delegation boundaries may still require judgment** -> Mitigation: anchor the docs to one task or a small coherent batch rather than open-ended execution.
- **Two layers of responsibility can create wording drift** -> Mitigation: update both `/pac-apply` and the apply skill from the same orchestration model.
- **Delegated execution could be mistaken for full autonomy** -> Mitigation: explicitly say the main agent reviews results and pauses on blockers before moving on.

## Migration Plan

1. Update the `ai-workflow-conventions` delta to document delegated, human-guided `/pac-apply` behavior.
2. Update `commands/pac-apply.md` to describe orchestration, scoped delegation, review, and pause behavior.
3. Update `skills/pac-openspec-apply-change/SKILL.md` to mirror the same flow and terminology.
4. Verify the resulting docs consistently describe per-slice delegation to the general subagent without changing unrelated workflows.

## Open Questions

- None.
