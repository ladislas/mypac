## 1. Align the active workflow spec with current `/pac-apply` behavior

- [x] 1.1 Update `openspec/specs/ai-workflow-conventions/spec.md` to remove delegated subagent promises and describe scoped main-agent execution.
- [x] 1.2 Verify the updated workflow spec against the current `pac-apply` prompt, skill, and repository guidance.

## 2. Simplify the active pre-commit validation contract

- [ ] 2.1 Update `openspec/specs/content-precommit-validation/spec.md` so it reflects the supported YAML/Markdown hook behavior and the `openspec/` Markdown override without promising `.opencode/` support as active workflow.
- [ ] 2.2 Verify the updated validation spec against `README.md`, `.config/hk.pkl`, and the active markdownlint configuration files.

## 3. Retire the unsupported GitHub task capture spec

- [ ] 3.1 Remove `openspec/specs/github-task-capture/spec.md` from the active spec surface.
- [ ] 3.2 Verify that no active Pi prompt, skill, or extension currently implements the removed `/add-task` capability.
