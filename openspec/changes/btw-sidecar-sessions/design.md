## Context

`/btw` currently stores its persisted state inside the active main session file using BTW-specific custom entries. That gives BTW persistence across reloads, but it mixes side-channel state into the main transcript and makes cleanup, lifecycle, and mental model awkward.

This change introduces a hidden sidecar session file per main session. The sidecar becomes the only persisted home for BTW thread state, imported main-session snapshots, and BTW metadata. BTW still runs as an isolated side conversation with explicit import and explicit handoff back to main.

Issue #52 and PR #57 already explored the user-facing import behavior and flushed out some practical bugs around keybindings, import filtering, snapshot persistence, and restore behavior. That prior work is valuable as behavioral reference, but it is not a requirement to preserve every implementation detail if the sidecar architecture allows a simpler or cleaner approach.

Key constraints:

- Keep BTW isolated by default.
- Do not surface BTW sidecars as normal sessions in `/resume`.
- Preserve the explicit import semantics and in-overlay import action from issue #52 / PR #57 while replacing the current storage model.
- Avoid speculative support for multiple BTW threads or branch-specific BTW in the first pass.

## Goals / Non-Goals

**Goals:**

- Persist BTW state outside the main session file.
- Preserve the current user-facing BTW import behavior from issue #52 / PR #57 unless the sidecar design gives a clearly simpler equivalent.
- Use a deterministic hidden location under the project session directory so lookup is simple and `/resume` stays clean.
- Keep one BTW sidecar per main session for the first pass.
- Record an open-time main-session anchor without importing context automatically.
- Make first import use the open-time anchor, then let later refresh/re-import use current main-session state.
- Persist imported snapshots only in the BTW sidecar and keep them as ordinary BTW history/context rather than system-prompt instructions.
- Keep BTW-to-main handoff explicit.
- Provide a best-effort path to recover existing inline BTW history into the new sidecar model.

**Non-Goals:**

- Multiple concurrent BTW threads per main session.
- Branch-specific BTW sidecars.
- Automatic sidecar cleanup or orphan garbage collection.
- A generalized multi-session graph model.
- Reworking BTW's user-facing overlay beyond what is needed to support the new persistence and import semantics.

## Decisions

### Preserve #52 semantics, not PR #57 implementation details

Use issue #52 and PR #57 as the semantic baseline for BTW import behavior: explicit in-overlay import, frozen snapshots, visible imported context, latest snapshot wins, and explicit BTW-to-main handoff. The sidecar implementation may simplify or replace PR #57 internals where that reduces complexity without changing those semantics.

Why:

- PR #57 already captures the intended user-facing behavior and a set of practical edge cases
- the sidecar architecture changes the storage boundary enough that directly transplanting PR #57 internals would be unnecessarily constraining
- this keeps the spec tied to behavior rather than to implementation churn from exploratory commits and follow-up bug fixes

Alternative considered:

- Treat PR #57 as the implementation template: rejected because it would overfit the new design to an earlier storage model

### Store BTW sidecars in a hidden per-project subdirectory

Use the active main session's project session directory (`ctx.sessionManager.getSessionDir()`) and place BTW files under:

```text
<sessionDir>/.btw-sidecars/<mainSessionId>/default.jsonl
```

Why:

- deterministic lookup for the v1 one-sidecar model
- naturally hidden from normal session listing because session listing only scans top-level project session files
- future-friendly for multiple BTW threads later via additional files in the per-main-session directory
- cleanup for one main session can be scoped to one directory

Alternatives considered:

- Flat filenames such as `<mainSessionId>.<btwThreadId>.jsonl`: workable, but requires scanning/parsing to find the default thread.
- Metadata in the main session file: rejected because it reintroduces BTW persistence concerns into the main session transcript.
- Top-level normal session files: rejected because they would leak implementation-detail sessions into normal session browsing.

### Link the sidecar to the main session via header and sidecar metadata

The sidecar session header SHALL record `parentSession` as the main session file path. The sidecar SHALL also keep BTW-specific metadata in sidecar-owned entries, including:

- main session id/path
- open-time anchor leaf id and timestamp
- latest imported snapshot metadata
- any migration/version markers needed for BTW state reconstruction

Why:

- header-level parent linkage gives cheap traceability and future tooling compatibility
- sidecar-owned metadata keeps BTW-specific runtime state out of the main session

Alternative considered:

- Registry file or separate index: rejected as unnecessary extra indirection for the first pass.

### Keep append-only BTW state entries in the sidecar and reconstruct runtime state from them

Rather than making the sidecar a pure native message transcript, BTW will continue to persist its own state as sidecar-owned entries and reconstruct the in-memory side session from that state.

Why:

- BTW already maintains structured thread state and reset markers this way
- latest-only import semantics are awkward with append-only message history, because old imported snapshots would remain in context
- reconstructing runtime state from the latest BTW entries lets the implementation keep only the active imported snapshot in context without mutating prior session history
- this still satisfies the architectural goal because the persisted storage is moved out of the main session and into a dedicated sidecar session file

Alternative considered:

- Persist imported snapshots as ordinary sidecar message history: rejected for v1 because replacing prior snapshots cleanly would require more complex branch manipulation or context filtering.

### One BTW sidecar per main session in v1

Scope BTW persistence to the main session id, not to branches or multiple named BTW threads.

Why:

- simplest mental model
- matches the agreed first-cut scope
- explicit import already gives enough control over what main context BTW sees

Alternative considered:

- branch-specific sidecars: rejected as more complex and surprising for a first pass.

### Capture an open-time anchor, not a full main-session snapshot

When BTW is opened, record the main session leaf id and timestamp as an anchor but do not import any main-session content yet.

Why:

- preserves the user's expectation of "what main looked like when I opened BTW" without eagerly duplicating content
- keeps BTW isolated until explicit import
- avoids hidden up-front context capture costs

Alternative considered:

- full snapshot on open: rejected because it duplicates context even when import is never used and makes BTW feel less explicitly isolated.

### Import semantics: anchored first import, current-state refresh thereafter

Import behavior SHALL work as follows:

- first explicit import uses the open-time anchor from when BTW was launched
- later refresh/re-import uses the current main-session state
- the latest imported snapshot replaces the previously active snapshot for future BTW prompts

Why:

- resolves the race between BTW opening and later main-session changes
- keeps the first import tied to the user's original BTW launch context
- still provides an explicit way to catch BTW up with new main-session work later

### Preserve legacy inline BTW history with best-effort migration

If a main session contains legacy inline BTW entries and no sidecar exists yet, BTW SHALL reconstruct the legacy thread and persist it into the new sidecar on first restore/open.

Why:

- avoids silently dropping existing BTW conversations during the storage migration
- keeps migration logic localized to BTW startup/restore

Alternative considered:

- hard reset on upgrade: rejected because it would discard persisted user state.

## Risks / Trade-offs

- [Sidecar metadata and reconstructed runtime can drift if restore logic is wrong] → Keep one canonical reconstruction path and verify restore/import/reset flows against persisted state.
- [PR #57's exploratory implementation may bias the refactor toward accidental complexity] → Re-evaluate each piece against the sidecar architecture and keep only the parts needed to preserve behavior.
- [Legacy migration may miss malformed old entries] → Make migration best-effort and ignore invalid legacy records rather than failing BTW entirely.
- [Orphan sidecars can accumulate after main-session deletion] → Tolerate orphans in v1 and leave cleanup automation for later follow-up work.
- [One BTW sidecar per main session may feel limiting for note-taking workflows] → Choose a storage layout that can add multiple BTW files under the same main-session directory later without redesigning the first pass.
- [Anchored first import may surprise users expecting "latest right now"] → Make the UI clearly distinguish initial import from refresh/re-import and show when the active snapshot was captured.
