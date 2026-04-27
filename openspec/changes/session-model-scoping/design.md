## Context

`mypac` runs on top of pi's extension API. Pi already stores session-local `model_change` and `thinking_level_change` entries and restores them when reopening a session, but `pi.setModel(...)` also writes `defaultProvider` and `defaultModel` to the global settings file. That write-through behavior is the root of cross-repo default leakage.

The local problem splits into two layers:

1. **Scope semantics**
   - global defaults in `~/.pi/agent/settings.json`
   - repo defaults in `.pi/settings.json`
   - session state in the session JSONL
2. **Workflow model usage**
   - workflows that need a different model for internal helper calls
   - workflows that need a newly created workflow session to start on a specific model/thinking pair

The extension API is sufficient for a repo-local solution, but only if we avoid relying on `pi.setModel(...)` as the mechanism for default persistence.

## Goals / Non-Goals

**Goals:**

- Make normal interactive model and thinking changes behave as session-scoped changes by default.
- Preserve explicit repo/global defaults as the seed for new sessions only.
- Pin every new session with an initial model and thinking level in session history.
- Provide an explicit way to persist the current active model/thinking level as a repo default or global default.
- Establish a workflow model abstraction that supports both direct helper-model calls and workflow-created sessions with a seeded model/thinking pair.
- Use public pi APIs and documented file formats where practical.

**Non-Goals:**

- Patch pi upstream or depend on unpublished pi internals.
- Rebuild pi's built-in `/model` UI.
- Introduce a separate per-session settings file for model/thinking state.
- Solve hypothetical live cross-window synchronization beyond the settings write-through already identified.
- Fully redesign all workflow commands in the first slice.

## Decisions

### 1. Add a dedicated model-scoping extension

Create a new multi-file extension under `extensions/model-scoping/` that owns repo-local scope behavior.

Rationale:

- The behavior is cross-cutting and should not be buried inside `/commit` or `/review`.
- A dedicated extension can react to model lifecycle events, read/write settings files, and expose explicit commands for default persistence.
- This keeps the policy localized and makes later workflow consumers depend on one clear abstraction.

Alternative considered:

- **Patch each extension individually**: rejected because it would duplicate settings logic and would not solve interactive `/model` changes.

### 2. Use branch-local session entries as the canonical session state

The effective model and thinking level for a session will be derived from the latest `model_change` and `thinking_level_change` entries on the active branch. New sessions will append initial entries for both values immediately at creation time.

Rationale:

- This matches pi's append-only, branch-aware session model.
- `/undo`, `/tree`, `/fork`, and resume flows naturally restore the state that was true at that point in the branch.
- It avoids inventing a second source of truth that could drift from session history.

Alternative considered:

- **Mutable top-level session metadata**: rejected because it would be session-global rather than branch-local, complicate `/undo` and `/tree`, and create sync problems with existing session entries.
- **Separate per-session settings file**: rejected because it would duplicate pi's native session state mechanism and add another restore path to reconcile.

### 3. Treat interactive model/thinking changes as session-scoped unless explicitly persisted

The model-scoping extension will capture the effective repo/global defaults at session start and, after implicit interactive changes, restore those saved defaults back to settings.

Expected effect:

- the session still records `model_change` / `thinking_level_change` entries
- the active session model/thinking still changes immediately
- resumed sessions still restore their own branch-local state
- new unrelated sessions keep using the saved repo/global defaults instead of inheriting the last interactive switch

Alternative considered:

- **Override pi's model selection mechanism directly**: rejected because pi does not expose a public API for replacing built-in model selection semantics.

### 4. Define precedence as “defaults seed, sessions own”

The precedence rules are:

- **Resume/open existing session**: latest session state on the active branch → repo defaults → global defaults → pi/provider fallback
- **Create new session**: repo defaults → global defaults → pi/provider fallback, then immediately pin the resolved model/thinking into session history

Additional rules:

- `defaultProvider` and `defaultModel` are treated as a pair at a given scope.
- A partial provider/model override at repo scope will be ignored for model selection rather than merged ambiguously.
- `defaultThinkingLevel` may override independently of the model pair.

Rationale:

- This gives each session a stable identity after creation.
- Later default changes affect future sessions only, not existing ones.

### 5. Make default persistence explicit via new commands

Add explicit commands that persist the current active model/thinking state as either:

- the repo default, by writing `.pi/settings.json`
- the global default, by writing `~/.pi/agent/settings.json`

These commands will update only the default-setting fields they own and preserve unrelated settings.

Rationale:

- It makes the session-vs-default distinction visible and intentional.
- It provides a supported replacement for the current implicit default rewrite behavior.

Alternative considered:

- **No explicit persistence command**: rejected because the new semantics would remove the practical way to intentionally change defaults.

### 6. Split workflow model overrides into two mechanisms

Use two different implementation paths for workflow model overrides:

1. **Direct helper-model calls**
   - for bounded tasks that do not need a full agent session
   - implemented by calling a chosen model directly through `@mariozechner/pi-ai` and `ctx.modelRegistry`
2. **Workflow-created session models**
   - for agentic workflows that need tools, prompts, and their own conversation state
   - implemented by creating/opening a session file whose initial branch already contains the desired `model_change` and `thinking_level_change` entries, then switching into that session

Rationale:

- These two use cases have different lifecycle requirements.
- `ctx.newSession({ setup })` is too late to influence startup model resolution, so seeded session files are the safer route for workflow-session model selection.

Alternative considered:

- **Use `pi.setModel(...)` temporarily for all workflows**: acceptable only as a transitional workaround, but rejected as the primary design because it still mutates active session state and pollutes session history.

### 7. Implement in phases, with session/default semantics first

Implementation order:

1. model-scoping foundation and explicit default commands
2. new-session pinning and branch-aware restore rules
3. migrate existing consumers that should stop leaking defaults
4. add workflow-session model seeding for `/review`
5. add direct helper-model consumers where appropriate

Rationale:

- Issues #56, #73, and #120 all depend on the same foundation.
- This order solves the user-visible leakage first while keeping later workflow work incremental.

## Risks / Trade-offs

- **Settings rewrite races between concurrent sessions** → Mitigation: restore only the saved effective defaults for implicit interactive changes, and use explicit commands for intentional default updates.
- **A repo-local extension cannot change pi core semantics perfectly** → Mitigation: stay within documented session and settings behavior, and document remaining edge cases.
- **Branch-aware restore may surprise users who expect model choice to be session-global rather than branch-local** → Mitigation: document that model/thinking follow the active branch in the same way other session history does.
- **Workflow commands that still use temporary session switching may leave extra `model_change` entries** → Mitigation: treat direct helper calls or seeded workflow sessions as the preferred follow-up migration path.
- **Seeded workflow sessions add implementation complexity around session creation/switching** → Mitigation: isolate that logic in a helper module and adopt it first in `/review`, where the need is clearest.
