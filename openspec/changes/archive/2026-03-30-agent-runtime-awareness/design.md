## Context

The repository already defines shared Rick persona primary agents with prompt-level role guidance and some permission constraints, but the runtime still lacks reliable awareness of agent identity, previous-agent handoffs, and active model metadata. In practice, that leaves long shared transcripts vulnerable to role bleed: `RickPlan` can inherit `RickBuild` momentum, reviewer agents can speak as if they authored the work they are critiquing, and prompt-only restrictions can be bypassed when a technically available tool remains reachable.

The proposed change stays local to this shared kit. Instead of depending on separate third-party plugins, the repository will own a small integrated OpenCode plugin that combines the useful parts of agent identity announcement and model announcement while adding session transition awareness.

## Goals / Non-Goals

**Goals:**

- Provide a single local plugin that tracks current agent, the last effective agent to handle a completed user turn, and the current model per session.
- Inject concise synthetic runtime context so agents understand identity, handoff boundaries, and how to interpret prior assistant messages.
- Expose a runtime introspection tool that review/meta agents can call when they need explicit session context.
- Preserve the existing Rick persona agent workflow while making mode separation more reliable.

**Non-Goals:**

- Replace OpenCode core agent/session semantics or patch upstream behavior directly.
- Build a generic policy engine for every possible agent in every future repository.
- Add elaborate workflow state machines, approval queues, or ceremony-heavy handoff metadata.
- Guarantee total impossibility of misuse outside OpenCode's available hook surface.

## Decisions

### Use one integrated shared-kit plugin instead of multiple external plugins

The system will define a shared-kit plugin under the repository-root `plugins/` directory rather than loading external npm plugins. This keeps behavior inspectable, versioned with the shared kit, and actually loadable when another repository consumes this kit through `OPENCODE_CONFIG_DIR`.

**Alternatives considered:**

- **Load external plugins as-is**: Fastest, but splits behavior across packages and leaves this repository dependent on external release cadence.
- **Copy external plugins verbatim**: Better than remote dependency, but still fragments the behavior and misses the handoff/enforcement additions that motivated the change.

### Track session runtime state explicitly

The plugin will maintain lightweight per-session state keyed by session ID, including at minimum:

- current agent
- last effective agent that handled a completed user turn
- previous agent only when the current turn represents a real handoff from that last effective agent
- current model identifier
- last switch/update timestamp or equivalent switch marker when detectable

This state will be refreshed from message metadata during chat transforms and reused during system prompt augmentation. Handoff context will be derived from the last agent that actually handled a completed user turn, not from transient agent selections caused by tab-cycling or agent picker changes that never produced a response.

**Alternatives considered:**

- **Infer everything from the current prompt each turn**: Simpler, but too fragile for multi-agent continuity.
- **Persist larger workflow history in plugin state**: Unnecessary complexity for the current problem.

### Inject a compact runtime handoff frame, not just a self-identity sentence

Instead of only appending `You are currently operating as X`, the plugin will inject a compact synthetic frame that can include:

- current agent
- previous effective agent when the current turn represents a real handoff
- current model
- instruction to treat prior assistant messages as historical outputs rather than current identity
- mode-specific reminder such as planning/review being non-implementation roles

The injected content should remain terse and synthetic to avoid polluting visible chat history or teaching the model noisy markup patterns. The plugin should emit handoff framing only on the first user turn handled by a different effective agent. If the user temporarily selects other agents but returns to the same effective agent before sending the next message, no handoff should be emitted.

**Alternatives considered:**

- **Identity-only announcement**: Helps with self-labeling but does not fully address transition confusion.
- **Visible handoff messages in transcript**: Easier to debug, but risks feedback loops and transcript clutter.

### Provide a dedicated runtime introspection tool for meta-agents

The plugin will expose a tool for explicit runtime queries, returning current runtime context such as current agent, previous agent, and current model. This supports contradictory reviewer agents and other meta-analysis flows without forcing all details into every prompt.

**Alternatives considered:**

- **System prompt only**: Works for basic identity, but review agents benefit from structured querying.
- **Reuse only attribution-style history output**: Helpful, but insufficient for current runtime state and policy inspection.

### Rely on OpenCode native permission frontmatter for agent-specific tool restrictions

Agent boundary enforcement uses the `permission` block in each agent's frontmatter rather than plugin-level hooks. The platform enforces `edit: deny` and the bash allow-list natively; the plugin does not duplicate this.

A bespoke shell parser was prototyped in the plugin and then removed. The tradeoff analysis showed that any custom shell-command filter is an unbounded maintenance surface: it requires tracking quoting rules, escape sequences, flag injection vectors, and binary allowlists — all of which the platform already handles more reliably through its own permission model. The enforcement was also redundant: the same boundaries were expressed twice (plugin and frontmatter) with diverging semantics. Keeping one authoritative layer is strictly better.

**Alternatives considered:**

- **Plugin-level tool.execute.before hook**: Prototyped but cut. Introduced a bespoke shell parser with correctness gaps and added no real security margin beyond what frontmatter already provides.
- **Prompt-only restrictions**: Insufficient on their own; frontmatter is the right complement.

## Risks / Trade-offs

- **[Risk] Runtime hooks cannot express every desired boundary** → **Mitigation:** context injection and introspection are the plugin's scope; enforcement is delegated to native permission frontmatter.
- **[Risk] Synthetic context becomes noisy or repetitive** → **Mitigation:** keep the injected handoff frame terse, stable, and invisible in normal transcript history.
- **[Risk] Local plugin behavior drifts from upstream ecosystem improvements** → **Mitigation:** design the plugin as a thin local layer, not a sprawling framework.
- **[Risk] Reviewer agents still inherit builder momentum in a shared transcript** → **Mitigation:** combine handoff framing and runtime introspection; hard mutation denial is handled by native frontmatter.

## Migration Plan

1. Add the integrated plugin under the shared-kit root and wire it into the repository's OpenCode plugin loading path.
2. Update shared Rick agent definitions so prompt guidance aligns with native permission frontmatter boundaries.
3. Verify plan/build/reviewer handoffs in local sessions, including model visibility.
4. Remove any redundant external plugin dependency if one was previously configured for the same behavior.

Rollback is straightforward: disable or remove the local plugin and fall back to the current prompt-only behavior.

## Open Questions

- Should the runtime introspection tool also expose full assistant-message attribution, or should that stay out of scope for the first cut?
- Do we want a separate read-only reviewer agent contract in this change, or only the runtime support needed for one?
