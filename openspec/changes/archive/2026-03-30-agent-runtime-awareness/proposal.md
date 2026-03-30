## Why

Switching between `RickPlan`, `RickBuild`, and other primary agents currently relies too heavily on prompt continuity, which causes identity bleed, mode confusion, and occasional attempts to implement in planning workflows. We need a local, integrated runtime-awareness layer so agent handoffs, model identity, and tool boundaries are reliable without depending on external plugins.

## What Changes

- Add a project-local OpenCode plugin that tracks per-session runtime awareness, including current agent, previous agent, and active model.
- Inject synthetic runtime context during chat turns so agents know who they are, what changed on handoff, and how to treat prior assistant messages.
- Provide a runtime introspection tool for agents that need to review multi-agent history or reason about handoffs explicitly.
- Update the Rick persona agent contract and supporting docs so planning/review behaviors align with OpenCode native permission frontmatter rather than bespoke plugin enforcement.

## Capabilities

### New Capabilities

- `agent-runtime-awareness`: Local OpenCode runtime-awareness plugin covering agent identity, handoff context, model announcements, and runtime introspection.

### Modified Capabilities

- `rick-persona-agents`: Strengthen agent boundary requirements so Rick persona agents use runtime-aware handoffs and OpenCode native permission-frontmatter restrictions rather than prompt-only guidance.

## Impact

- Affected code: shared OpenCode plugin assets, shared agent definitions, and any supporting config needed to load the runtime-awareness plugin from the shared kit root.
- Affected behavior: plan/build/review switching, contradictory review workflows, and multi-model agent awareness.
- Dependencies: OpenCode local plugin hooks and existing agent metadata surfaced through runtime message/session context.
