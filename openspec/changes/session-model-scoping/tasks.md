## 1. Model-scoping foundation

- [x] 1.1 Add a dedicated `extensions/model-scoping/` extension with helpers for reading and writing repo/global default model and thinking settings
- [x] 1.2 Capture the effective repo/global defaults at session start and restore them after implicit interactive model/thinking changes
- [x] 1.3 Add explicit commands to persist the current active model/thinking state as the repo defaults or the global defaults
- [x] 1.4 Add focused tests for settings-file merge/update behavior, partial repo model overrides, and default-restoration logic

## 2. Session pinning and branch-aware restore

- [ ] 2.1 Add new-session initialization that pins the resolved initial model and thinking level into session history immediately
- [ ] 2.2 Add branch-aware restore logic/tests covering resume, `/undo`, and `/tree` behavior for model and thinking state
- [ ] 2.3 Add restore-fallback behavior/tests for unavailable saved session models without mutating session history or defaults

## 3. Workflow integration

- [ ] 3.1 Update workflow code that currently relies on `pi.setModel(...)` for temporary model switching so it no longer leaks repo/global defaults
- [ ] 3.2 Add a helper for creating or switching into a workflow session seeded with a chosen model/thinking pair
- [ ] 3.3 Integrate the seeded-session helper into `/review` for review-session model selection
- [ ] 3.4 Identify bounded helper workflows that can use direct helper-model calls and migrate the first consumer if it materially improves isolation

## 4. Verification and documentation

- [ ] 4.1 Document the session-vs-default model/thinking semantics and the explicit default-persistence commands
- [ ] 4.2 Run `npm test` and `npm run typecheck` after the extension and workflow integrations land
- [ ] 4.3 Verify the key user flows manually: cross-repo isolation, resumed-session restore, `/undo` and `/tree` branch-local restore, explicit repo/global default persistence, and review-session model seeding
