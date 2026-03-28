## 1. Update the workflow contract

- [x] 1.1 Update the `ai-workflow-conventions` delta spec so atomic implementation commits and explicit file selection are part of the repository contract
- [x] 1.2 Update repository-level guidance (`AGENTS.md`, `.opencode/AGENTS.md`, and `docs/playbooks/openspec.md`) to apply the same atomic commit rule to both OpenSpec and manual work

## 2. Align OpenSpec implementation guidance

- [x] 2.1 Update `commands/pac-apply.md` to require atomic commits per meaningful task section or task group during implementation
- [x] 2.2 Update `skills/pac-openspec-apply-change/SKILL.md` with the same task-group commit guidance and verification boundary

## 3. Prevent unrelated files from leaking into commits

- [ ] 3.1 Update `commands/commit.md` so commit file selection is explicit and unrelated staged files are excluded from the current commit group
- [ ] 3.2 Update `agents/RickBuild.md` so manual todo-driven implementation follows the same atomic-commit and explicit-file-selection rules

## 4. Verify consistency

- [ ] 4.1 Review the updated docs, commands, and agent guidance for consistent wording around atomic task-group commits and explicit file selection
