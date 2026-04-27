## ADDED Requirements

### Requirement: Session model and thinking state are branch-local

The effective model and thinking level for a session SHALL be determined from the latest `model_change` and `thinking_level_change` entries on the active branch.

#### Scenario: Resume restores latest session state

- **WHEN** the user resumes a session that previously changed model and thinking level
- **THEN** pi SHALL restore the latest model recorded on that session's active branch
- **AND** pi SHALL restore the latest thinking level recorded on that session's active branch
- **AND** that restore SHALL not depend on the current repo/global default values unless the session state cannot be restored

#### Scenario: Tree or undo navigation restores branch-local state

- **WHEN** the user navigates to an earlier point in the session tree or undoes back before a later model or thinking change
- **THEN** the effective model SHALL match the latest `model_change` entry reachable on the new active branch
- **AND** the effective thinking level SHALL match the latest `thinking_level_change` entry reachable on the new active branch

### Requirement: New sessions are pinned immediately from effective defaults

A newly created session SHALL resolve its initial model and thinking level from explicit defaults or fallback behavior, then append initial session entries for both values at creation time.

#### Scenario: Repo defaults override global defaults for a new session

- **WHEN** both global defaults and repo defaults exist for a repository
- **THEN** the new session SHALL resolve its initial provider/model pair from the repo defaults
- **AND** the new session SHALL resolve its initial thinking level from the repo default when present, otherwise from the global default
- **AND** the new session SHALL append initial `model_change` and `thinking_level_change` entries for the resolved values

#### Scenario: Global defaults seed a new session when no repo model default exists

- **WHEN** the current repository does not define a complete repo default provider/model pair
- **AND** global defaults are configured
- **THEN** the new session SHALL resolve its initial model from the global default provider/model pair
- **AND** the new session SHALL append initial `model_change` and `thinking_level_change` entries for the resolved values

#### Scenario: Partial repo model override is ignored

- **WHEN** repo settings define only `defaultProvider` or only `defaultModel`
- **THEN** that partial repo model override SHALL NOT be merged with the global model default
- **AND** model selection for the new session SHALL fall back to the next broader complete provider/model pair

#### Scenario: Provider fallback is pinned when no defaults exist

- **WHEN** neither repo nor global defaults provide a usable initial model
- **THEN** the new session SHALL use pi/provider fallback behavior to choose an initial model and thinking level
- **AND** the new session SHALL append initial `model_change` and `thinking_level_change` entries for the chosen values

### Requirement: Interactive model and thinking changes are session-scoped by default

When model scoping is enabled for the repository, changing the active model or thinking level during a session SHALL update that session's active state and session history without implicitly rewriting the saved repo or global defaults.

#### Scenario: Interactive model switch preserves saved defaults

- **WHEN** the user changes the active model in an existing session
- **THEN** the session SHALL use the newly selected model immediately
- **AND** the session SHALL record the model change in session history
- **AND** the previously saved repo/global default model SHALL remain unchanged

#### Scenario: Interactive thinking change preserves saved defaults

- **WHEN** the user changes the active thinking level in an existing session
- **THEN** the session SHALL use the newly selected thinking level immediately
- **AND** the session SHALL record the thinking-level change in session history
- **AND** the previously saved repo/global default model/thinking defaults SHALL remain unchanged

### Requirement: Default persistence is explicit

The repository SHALL provide an explicit action to persist the current active model and thinking level as a repo default or a global default.

#### Scenario: Persist current state as repo defaults

- **WHEN** the user explicitly saves the current active model and thinking level as repo defaults
- **THEN** `.pi/settings.json` SHALL be updated with that provider/model pair and thinking level
- **AND** future new sessions in the repository SHALL start with those values unless overridden more specifically

#### Scenario: Persist current state as global defaults

- **WHEN** the user explicitly saves the current active model and thinking level as global defaults
- **THEN** `~/.pi/agent/settings.json` SHALL be updated with that provider/model pair and thinking level
- **AND** future new sessions outside repositories with repo defaults SHALL start with those values

### Requirement: Restore fallback does not mutate saved state

If a saved session model or thinking state cannot be restored, the system SHALL fall back without mutating the saved session record or implicitly rewriting repo/global defaults.

#### Scenario: Saved session model is unavailable

- **WHEN** a resumed session's saved model no longer exists or does not have configured auth
- **THEN** the system SHALL fall back to the effective repo/global default model or provider fallback
- **AND** the saved `model_change` entry in the session history SHALL remain unchanged
- **AND** the repo/global defaults SHALL remain unchanged unless the user explicitly persists a new default
