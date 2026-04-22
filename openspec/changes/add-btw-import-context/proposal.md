## Why

Making `/btw` isolated by default fixed context leakage, but it also removed the frozen main-session context that made side conversations useful during active work. Users now need an explicit way to bring relevant main-session context into BTW when the side discussion is about the current task, without reintroducing live execution noise.

## What Changes

- Add an explicit in-overlay `Import context` action for `/btw`.
- Import a frozen snapshot of the current main-session context only when the user asks for it.
- Build imported context from the resolved main session so compaction and branch summaries still carry forward useful context.
- Filter imported context to preserve conversational usefulness while avoiding raw live execution noise.
- Make imported context visible inside the BTW overlay so users can tell when BTW is operating with imported main-session context.
- Keep `/btw` isolated by default and avoid restoring any live shared-context behavior.

## Capabilities

### New Capabilities

- `btw-import-context`: Explicitly import a frozen main-session snapshot into BTW for context-aware side discussions.

### Modified Capabilities

- None.

## Impact

- Affects `extensions/btw.ts` state restoration, side-session seeding, and overlay rendering.
- Reuses Pi session-context APIs such as `buildSessionContext(...)` and `convertToLlm(...)` to construct the import snapshot.
- No new external dependencies or model-side summarization pass.
