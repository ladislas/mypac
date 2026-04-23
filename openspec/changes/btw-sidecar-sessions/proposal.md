## Why

`/btw` is meant to feel like an isolated side conversation, but today its persisted state is stored inside the main session file as BTW-owned custom entries. That mixes two different concerns in one transcript, makes cleanup awkward, and creates a persistence model that does not match the user-facing mental model.

This change moves BTW persistence into hidden linked sidecar sessions while preserving BTW's explicit isolation model. It absorbs the user-facing import behavior explored in issue #52 and PR #57, while treating that prior implementation as reference rather than a constraint if a simpler sidecar-based implementation emerges.

## What Changes

- Persist BTW conversations in hidden sidecar session files instead of embedding BTW state in the main session transcript.
- Link each BTW sidecar to one main session and keep the sidecar out of normal session browsing surfaces.
- Preserve BTW's isolation-by-default behavior and the explicit in-overlay import action introduced for #52: main-session context is not shared automatically.
- Carry forward BTW's explicit import semantics with an open-time anchor, frozen imported snapshots, and explicit refresh/re-import behavior.
- Keep BTW-to-main handoff explicit via summary/injection rather than automatic transcript merging.
- Explicitly keep branch-specific BTW threads, multiple attached BTW threads, and cleanup automation out of scope for the first pass.

## Capabilities

### New Capabilities

- `btw-sidecar-sessions`: Hidden BTW sidecar session persistence linked to a main session, with predictable lifecycle and lookup rules.
- `btw-import-context`: Explicit BTW import behavior for anchored, frozen main-session snapshots that remain visible and user-controlled.

### Modified Capabilities

- None.

## Impact

- Affected code: `extensions/btw.ts` and any shared session-management helpers it needs.
- Affected systems: session persistence, BTW overlay state restoration, BTW lifecycle across reopen/reload/new/fork flows, and BTW import/inject behavior.
- Storage impact: hidden BTW sidecar files under the project session directory instead of BTW custom entries in the main session file.
- Prior work impact: this change supersedes the older `add-btw-import-context` planning by preserving its user-facing semantics while replacing its storage architecture.
- User-facing impact: BTW remains isolated by default, but imported main-session context becomes an explicit, visible, refreshable snapshot with clearer semantics.
