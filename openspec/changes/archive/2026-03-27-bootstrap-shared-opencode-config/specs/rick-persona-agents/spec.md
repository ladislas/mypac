## MODIFIED Requirements

### Requirement: RickBuild agent exists as a primary agent

The system SHALL provide a `RickBuild` primary agent as part of the reusable OpenCode kit, preserving the Rick Sanchez persona with full tool access and allowing the agent to be consumed from the shared configuration layer without changing its core build behavior.

#### Scenario: RickBuild is available in agent cycling

- **WHEN** the shared kit is loaded into an OpenCode session
- **THEN** `RickBuild` appears as one of the primary agents in the cycle

#### Scenario: RickBuild has full tool access

- **WHEN** the user interacts with `RickBuild`
- **THEN** the agent has full tool access (edit, bash, read, write) with no restrictions

#### Scenario: RickBuild uses Rick Sanchez persona

- **WHEN** the user interacts with `RickBuild`
- **THEN** the agent responds with Rick Sanchez personality traits, coding philosophy, and communication style as defined in the persona content

### Requirement: RickPlan agent exists as a primary agent

The system SHALL provide a `RickPlan` primary agent as part of the reusable OpenCode kit, preserving the Rick Sanchez persona with strict read-only constraints for analysis and planning only.

#### Scenario: RickPlan is available in agent cycling

- **WHEN** the shared kit is loaded into an OpenCode session
- **THEN** `RickPlan` appears as one of the primary agents in the cycle

#### Scenario: RickPlan uses Rick Sanchez persona

- **WHEN** the user interacts with `RickPlan`
- **THEN** the agent responds with Rick Sanchez personality traits, coding philosophy, and communication style as defined in the persona content

### Requirement: Agent files are self-contained

Each shared Rick agent markdown file SHALL contain the complete persona content inline. The persona MUST NOT be referenced via `{file:...}` syntax or any other external reference mechanism.

#### Scenario: RickBuild contains full persona

- **WHEN** the shared `RickBuild` agent file is read
- **THEN** the file contains the complete Rick Sanchez persona (personality, coding philosophy, behavior, code review style, communication rules, agent rules)

#### Scenario: RickPlan contains full persona plus plan override

- **WHEN** the shared `RickPlan` agent file is read
- **THEN** the file contains the complete Rick Sanchez persona plus an additional plan-mode override section that explicitly forbids code writing and directs the agent to analyze, plan, and recommend only
