# shared-opencode-config Specification

## Purpose

Define how this repository provides a reusable shared OpenCode kit, including its loading model, naming conventions, layering behavior, and bootstrap constraints.

## Requirements

### Requirement: Repository defines a reusable shared OpenCode kit

The system SHALL define this repository as a reusable OpenCode configuration kit that can be consumed as a shared source of truth across projects while remaining compatible with project-local `.opencode/` assets.

#### Scenario: Shared kit structure is discoverable

- **WHEN** a reader inspects the repository
- **THEN** they can identify the canonical shared OpenCode asset locations for agents, commands, and skills at the repository root

#### Scenario: Shared kit coexists with project-local overlays

- **WHEN** the shared kit is used in another repository that also has local `.opencode/` assets
- **THEN** the architecture supports additive project-local agents, commands, and skills without requiring the shared kit to be copied into that repository

### Requirement: Shared kit supports opt-in loading via OPENCODE_CONFIG_DIR

The system SHALL support loading the shared OpenCode kit via `OPENCODE_CONFIG_DIR` so the personal workflow can be enabled per session or repository while remaining easy to opt out of.

#### Scenario: Shared kit is loaded through repository root

- **WHEN** a user runs OpenCode with `OPENCODE_CONFIG_DIR` pointing at the shared kit repository root
- **THEN** OpenCode loads the shared agents, commands, and skills from that directory

#### Scenario: Project-local config remains additive

- **WHEN** a repository has its own local `.opencode/` assets and the shared kit is also loaded via `OPENCODE_CONFIG_DIR`
- **THEN** the project-local assets remain additive overlays rather than requiring the shared kit to be vendored into the project

#### Scenario: User opts out of shared kit

- **WHEN** a user runs OpenCode without `OPENCODE_CONFIG_DIR` set for a repository
- **THEN** the shared personal kit is not loaded for that session

### Requirement: Shared OpenCode assets use a canonical namespace with runtime-compatible bootstrap exceptions

The system SHALL define a canonical naming convention for shared OpenCode assets using a common `pac-` namespace prefix, while limiting bootstrap exceptions to asset types whose runtime-visible name is filename-bound and intentionally preserved for compatibility.

#### Scenario: Shared skill is uniquely identifiable

- **WHEN** a shared skill is added to the kit
- **THEN** its canonical identifier uses the shared namespace prefix and does not rely on punctuation outside kebab-case

#### Scenario: Shared command is uniquely identifiable

- **WHEN** a shared OpenSpec workflow command is defined in the kit
- **THEN** its filename-derived runtime command name uses the `pac-` namespace rather than a generic `opsx-` prefix

#### Scenario: Bootstrap agent remains clearly distinguishable

- **WHEN** the bootstrap preserves an existing shared primary agent whose runtime name is derived from the filename
- **THEN** that agent may keep its established runtime name and the exception is documented as a compatibility choice

### Requirement: Canonical identifiers are the source of truth where OpenCode supports them cleanly

The system SHALL treat canonical shared identifiers as the source of truth for shared skills and shared commands, while documenting compatibility-preserving exceptions only for bootstrap assets whose visible runtime identity intentionally remains filename-bound.

#### Scenario: Skill file and internal name use canonical namespace

- **WHEN** a shared skill is defined in the repository
- **THEN** its directory name and internal skill name use the canonical `pac-` namespace

#### Scenario: Shared command filename uses canonical namespace

- **WHEN** a shared OpenSpec workflow command is defined in the repository
- **THEN** its command filename and user-facing runtime name use the canonical `pac-` namespace

#### Scenario: User-facing label may remain concise

- **WHEN** OpenCode supports a separate user-facing label or description for a shared asset
- **THEN** that visible label may remain more concise than the canonical identifier without changing the underlying canonical name

#### Scenario: Remaining bootstrap exception is documented

- **WHEN** a shared bootstrap agent keeps an established runtime-visible name for compatibility
- **THEN** the repository documentation explains that exception and distinguishes it from shared commands that now use the canonical `pac-` namespace directly

### Requirement: Shared workflow references stay consistent with canonical command names

The system SHALL keep shared command instructions, shared skill prompts, and repository workflow documentation aligned with the canonical shared `/pac-*` command set.

#### Scenario: Shared command instructions use canonical names

- **WHEN** a reader opens a shared command definition or shared skill instruction
- **THEN** cross-references to the OpenSpec workflow point to the corresponding `/pac-*` command names

#### Scenario: Workflow playbooks use canonical names

- **WHEN** a reader follows local workflow documentation for the shared OpenCode kit or OpenSpec usage
- **THEN** the documented command examples use `/pac-*` consistently instead of stale `/opsx-*` references

### Requirement: Shared commands coexist cleanly with repository-local overlays

The system SHALL expose shared workflow commands under the `pac-` namespace so they remain distinguishable when the shared kit is loaded alongside repository-local `.opencode/commands` assets.

#### Scenario: Shared and local commands appear together without namespace collision

- **WHEN** `OPENCODE_CONFIG_DIR` loads the shared kit and a repository also defines local OpenCode commands
- **THEN** the resolved command set includes the shared `/pac-*` commands alongside the local commands without requiring shared generic `/opsx-*` names

#### Scenario: Repository can keep its own OpenSpec-flavored commands

- **WHEN** a repository defines its own OpenSpec-related command names for local workflow needs
- **THEN** the shared workflow remains separately accessible through the `pac-` command namespace

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
