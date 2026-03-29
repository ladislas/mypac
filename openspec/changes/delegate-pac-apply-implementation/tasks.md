## 1. Update `/pac-apply` orchestration guidance

- [x] 1.1 Revise `commands/pac-apply.md` so the main agent reads apply context, selects the next task or small coherent batch, and delegates scoped implementation to the general subagent
- [x] 1.2 Clarify in `commands/pac-apply.md` that the main agent reviews delegated results, updates task state when appropriate, continues on success, and pauses on blockers or ambiguity
- [x] 1.3 Preserve the existing atomic commit guidance in `commands/pac-apply.md` within the delegated execution flow

## 2. Align the apply skill with delegated execution

- [x] 2.1 Update `skills/pac-openspec-apply-change/SKILL.md` to describe the same orchestrator loop and per-slice delegation model as `commands/pac-apply.md`
- [x] 2.2 Use actual Task/general-subagent terminology in `skills/pac-openspec-apply-change/SKILL.md` instead of invented delegation syntax
- [x] 2.3 Clarify in `skills/pac-openspec-apply-change/SKILL.md` that scoped implementation is delegated while orchestration, review, and pause decisions remain with the main agent

## 3. Verify consistency and scope

- [x] 3.1 Review the updated `/pac-apply` docs and skill guidance to confirm they both describe per-task or small-batch delegation rather than whole-change autonomy
- [x] 3.2 Verify the final wording preserves existing atomic commit guidance and does not introduce unrelated workflow redesign or task-selection UX changes
