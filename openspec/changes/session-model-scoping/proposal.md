## Why

Pi already records model and thinking changes in session history, but changing the active model also rewrites the global default model. That makes concurrent work across repositories or across distinct workflows interfere with each other, and it blocks predictable review and automation flows that need a different model than the current implementation session.

This change is needed now because multiple open issues depend on the same missing distinction between a session's active model/thinking state and a repo/global default model/thinking configuration, and because workflow commands like `/review`, `/commit`, and `/ghi` need a clear foundation before model-specific behavior can be added safely.

## What Changes

- Add a repo-local model-scoping capability that preserves a session's active model and thinking level without implicitly rewriting repo/global defaults during normal interactive switching.
- Define explicit precedence rules for session state, repo defaults, and global defaults.
- Define new-session behavior so each new session is immediately pinned with an initial model and thinking level in session history.
- Add explicit actions to persist the current active model/thinking level as a repo default or a global default.
- Add a workflow-level mechanism for commands that need a different model than the current session, distinguishing between:
  - internal helper/model calls that should not mutate session or default model state, and
  - workflow-created sessions that should start on a specific active model/thinking level without changing defaults.
- Update affected workflow extensions to use the new model-scoping behavior instead of relying on `pi.setModel(...)` when that would leak state.
- Document the intended semantics and the first consumer workflows.

## Capabilities

### New Capabilities

- `session-model-scoping`: Separate session active model/thinking behavior from repo/global default model/thinking behavior, including resume/new-session semantics, branch-aware restore semantics, and explicit default persistence rules.
- `workflow-model-overrides`: Allow workflow commands to use dedicated model/thinking settings either internally or when creating a new workflow session, without implicitly changing repo/global defaults.

### Modified Capabilities

- None.

## Impact

- New or updated extension code for model-scoping and workflow model helpers.
- Changes to workflow extensions that currently switch models through `pi.setModel(...)`, especially `extensions/commit/` and review-related flows.
- New OpenSpec capability specs and implementation tasks covering issues #56, #73, and #120.
- Documentation for model/thinking scope semantics and workflow expectations.
