## MODIFIED Requirements

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
