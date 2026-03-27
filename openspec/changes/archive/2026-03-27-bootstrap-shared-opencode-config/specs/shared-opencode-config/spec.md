## ADDED Requirements

### Requirement: Repository defines a reusable shared OpenCode kit

The system SHALL define this repository as a reusable OpenCode configuration kit that can be consumed as a shared source of truth across projects while remaining compatible with project-local `.opencode/` assets.

#### Scenario: Shared kit structure is discoverable

- **WHEN** a reader inspects the repository
- **THEN** they can identify the canonical shared OpenCode asset locations for agents, commands, and skills

#### Scenario: Shared kit coexists with project-local overlays

- **WHEN** the shared kit is used in another repository that also has local `.opencode/` assets
- **THEN** the architecture supports additive project-local agents, commands, and skills without requiring the shared kit to be copied into that repository

### Requirement: Shared kit supports opt-in loading via OPENCODE_CONFIG_DIR

The system SHALL support loading the shared OpenCode kit via `OPENCODE_CONFIG_DIR` so the personal workflow can be enabled per session or repository while remaining easy to opt out of.

#### Scenario: Shared kit is loaded through custom config directory

- **WHEN** a user runs OpenCode with `OPENCODE_CONFIG_DIR` pointing at the shared kit repository
- **THEN** OpenCode loads the shared agents, commands, and skills from that directory

#### Scenario: Project-local config remains additive

- **WHEN** a repository has its own local `.opencode/` assets and the shared kit is also loaded via `OPENCODE_CONFIG_DIR`
- **THEN** the project-local assets remain additive overlays rather than requiring the shared kit to be vendored into the project

#### Scenario: User opts out of shared kit

- **WHEN** a user runs OpenCode without `OPENCODE_CONFIG_DIR` set for a repository
- **THEN** the shared personal kit is not loaded for that session

### Requirement: Shared OpenCode assets use a canonical namespace with runtime-compatible bootstrap exceptions

The system SHALL define a canonical naming convention for shared OpenCode assets using a common `pac-` namespace prefix, while explicitly documenting bootstrap exceptions for asset types whose runtime-visible name is derived directly from the filename.

#### Scenario: Shared skill is uniquely identifiable

- **WHEN** a shared skill is added to the kit
- **THEN** its canonical identifier uses the shared namespace prefix and does not rely on punctuation outside kebab-case

#### Scenario: Bootstrap command remains clearly distinguishable

- **WHEN** the bootstrap preserves an existing shared command whose runtime name is derived from the filename
- **THEN** that command remains visibly distinguishable from unprefixed project-local commands and the exception is documented as a compatibility choice

#### Scenario: Bootstrap agent remains compatible

- **WHEN** the bootstrap preserves an existing shared primary agent whose runtime name is derived from the filename
- **THEN** that agent may keep its established runtime name and the exception is documented as a compatibility choice

### Requirement: Canonical identifiers are the source of truth where OpenCode supports them cleanly

The system SHALL treat canonical shared identifiers as the source of truth for asset types that support them cleanly, while documenting compatibility-preserving exceptions for bootstrap assets whose visible runtime identity is filename-bound.

#### Scenario: Skill file and internal name use canonical namespace

- **WHEN** a shared skill is defined in the repository
- **THEN** its directory name and internal skill name use the canonical `pac-` namespace

#### Scenario: User-facing label may remain concise

- **WHEN** OpenCode supports a separate user-facing label or description for a shared asset
- **THEN** that visible label may remain more concise than the canonical identifier without changing the underlying canonical name

#### Scenario: Bootstrap compatibility exception is documented

- **WHEN** a shared bootstrap agent or command keeps an established runtime-visible name for compatibility
- **THEN** the repository documentation explains that exception and ties it to the minimal-change bootstrap strategy

### Requirement: Bootstrap implementation remains intentionally small

The system SHALL bootstrap the shared kit using the assets already present in this repository plus only the minimum placeholders needed to validate the structure.

#### Scenario: Bootstrap focuses on existing assets

- **WHEN** the initial shared-kit implementation is created
- **THEN** it promotes the current agents, OpenSpec commands, and OpenSpec support skills before importing broader external skill catalogs

#### Scenario: Placeholder assets are allowed for structure validation

- **WHEN** a desired future capability needs representation during bootstrap
- **THEN** a lightweight placeholder may be added instead of a full imported workflow so long as the architecture can be tested

### Requirement: Bootstrap favors minimal structural change

The system SHALL favor the smallest structural changes needed to validate the shared-kit architecture, preserving existing working agents, commands, and skills unless a change is required for namespacing, reuse, or layering.

#### Scenario: Existing asset remains in place when no structural change is needed

- **WHEN** an existing working agent, command, or skill already satisfies the bootstrap architecture
- **THEN** the implementation preserves it rather than refactoring it unnecessarily

#### Scenario: Structural change is made only to satisfy bootstrap goals

- **WHEN** an existing asset is renamed, moved, or reshaped during bootstrap
- **THEN** that change is directly justified by the shared-kit architecture, namespacing, or layering model
