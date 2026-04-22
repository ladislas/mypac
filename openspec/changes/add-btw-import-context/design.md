## Context

`/btw` now starts with an isolated side-session and only carries its own BTW thread history. That fixed main-session leakage, but it also removed the frozen task context that made BTW useful for discussing the work already in progress. The repository wants BTW to stay isolated by default while allowing an explicit, predictable import of relevant main-session context from inside the BTW overlay.

## Goals / Non-Goals

**Goals:**

- Preserve `/btw`'s isolated-by-default behavior.
- Let users import current main-session context from inside the BTW overlay without leaving the side chat.
- Reuse Pi's resolved session context so imported snapshots already include compaction and branch-summary effects.
- Preserve discussion-relevant tool context without dumping raw execution output into BTW.
- Make imported context visible in BTW and easy to refresh intentionally.

**Non-Goals:**

- Restoring live shared context between the main session and BTW.
- Adding model-generated summaries or any extra LLM pass during import.
- Importing workspace-only state such as git diff summaries or changed-file snapshots.
- Designing a general-purpose cross-session context transfer mechanism beyond BTW.
- Optimizing BTW behavior around provider-specific prompt cache read/write effects.

## Decisions

### Use resolved main-session context as the import source

Use `buildSessionContext(...)` on the current main session at import time, then normalize it with `convertToLlm(...)` before BTW-specific filtering.

This reuses Pi's existing context resolution behavior instead of reconstructing branch, compaction, and custom-message semantics inside the BTW extension.

**Alternatives considered:**

- Reading raw session entries directly: more brittle and would duplicate Pi session-resolution logic.
- Reintroducing implicit seeding on BTW session creation: restores hidden coupling and undermines issue #51.

### Filter imported context into BTW-friendly messages

Imported context will keep user messages, assistant text, and already-normalized branch/compaction/bash text. Assistant tool calls will be collapsed into compact textual summaries, and raw `toolResult` bodies will not be imported.

This keeps BTW aware of tool-focused discussion without dragging large command output or tool-result noise back into the side chat.

**Alternatives considered:**

- Dropping all tool context: too lossy for discussions about recent tool activity.
- Importing raw tool calls and tool results unchanged: too noisy and too close to the pre-isolation behavior.

### Persist imported context as BTW-owned state

Store imported context in a dedicated BTW custom entry and restore the latest imported snapshot after the most recent BTW reset. BTW thread history remains separate from imported-context state.

This keeps import behavior explicit and durable across session reloads without making the main session responsible for BTW state.

**Alternatives considered:**

- Hidden in-memory-only import state: simpler, but lost on reload and harder to reason about.
- Appending imported context as normal BTW question/answer turns: mixes source context with actual side conversation history.

### Recreate the BTW side session after import refreshes context

After importing context, dispose the active BTW side session so the next BTW prompt is seeded from the refreshed imported snapshot plus BTW thread history.

This avoids stale model-side state and keeps the effective side-session seed aligned with what the overlay shows.

**Alternatives considered:**

- Mutating the active side session in place: more complex and easier to get wrong.
- Waiting until `/btw` is reopened: less predictable for users who import context mid-conversation.

### Surface import through an in-overlay action hint

Expose `Import context` as an in-overlay action alongside the existing footer hints (submit, newline, close). The overlay transcript will also show a visible imported-context block so users can tell when BTW is using imported main-session context.

This keeps the feature discoverable inside BTW and avoids forcing users to exit or remember a separate external flow.

**Alternatives considered:**

- A separate `/btw import` command only: workable, but less discoverable while already inside the overlay.
- Hidden reseeding with no visible transcript marker: too implicit and likely to confuse users.

## Risks / Trade-offs

- **Import filtering still includes too much or too little context** → Keep the first version intentionally narrow and based on deterministic filtering rules that can be adjusted later.
- **Large imported snapshots could make BTW context heavy again** → Prefer compact tool summaries, reuse existing compaction summaries, and avoid raw tool-result bodies.
- **Users may expect import to keep syncing automatically** → Show imported context explicitly as an intentional snapshot and keep BTW isolated by default.
- **Mid-request imports could conflict with active BTW execution** → Gate or defer import while BTW is busy so seed state stays coherent.
- **Prompt-cache behavior may change as import formatting changes** → Treat cache read/write effects as opportunistic, not as a required behavior; prioritize explicit useful context and deterministic snapshot construction.
