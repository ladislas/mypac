## 1. Runtime awareness foundation

- [x] 1.1 Add a local OpenCode plugin entry point for runtime awareness under `.opencode/plugins/`
- [x] 1.2 Implement session-scoped runtime state tracking for current agent, last effective agent, real handoff detection, and active model metadata
- [x] 1.3 Load the plugin through the repository's local OpenCode configuration path and document any required local dependency wiring

## 2. Synthetic context and introspection

- [ ] 2.1 Inject compact synthetic runtime context that announces current agent, real handoff context when applicable, and active model
- [ ] 2.2 Add handoff framing that tells the active agent to treat prior assistant outputs as historical messages rather than current identity
- [ ] 2.3 Expose a runtime introspection tool that returns current agent, previous agent, active model, and policy classification

## 3. Enforcement and agent alignment

- [ ] 3.1 Implement tool-execution policy checks that deny file mutation for non-build agents
- [ ] 3.2 Implement shell allow/deny enforcement so non-build agents cannot execute arbitrary implementation commands
- [ ] 3.3 Update Rick persona agent definitions and related docs so prompt guidance matches the new runtime-enforced boundaries

## 4. Verification

- [ ] 4.1 Verify plan-to-build and build-to-plan switches preserve correct runtime identity and only emit handoff framing on real effective-agent changes
- [ ] 4.2 Verify a non-build reviewer/planning flow can inspect runtime context while remaining unable to mutate files or run blocked shell commands
- [ ] 4.3 Run the relevant repository checks, including `mise lint:markdown` for OpenSpec artifacts and the smallest appropriate `mise`/project validation for plugin changes
