# rick-persona-agents Specification

## Purpose

Define the shared Rick Sanchez–persona primary agents, including their availability, behavioral boundaries, and tool-access model within the reusable OpenCode kit.

## Requirements

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

### Requirement: RickPlan SHALL NOT modify files

The system SHALL deny file-modifying actions for `RickPlan` through OpenCode native permission frontmatter (`edit: deny`) in the agent definition. Prompt guidance reinforces the boundary; the platform enforces it.

#### Scenario: RickPlan cannot edit files

- **WHEN** `RickPlan` attempts to use the edit tool
- **THEN** the tool execution is denied by the agent permission configuration

#### Scenario: RickPlan cannot write new files

- **WHEN** `RickPlan` attempts to use file-creation or file-writing tools
- **THEN** the tool execution is denied by the agent permission configuration

#### Scenario: RickPlan prompt reinforces no-code policy

- **WHEN** the user asks `RickPlan` to write or modify code
- **THEN** the agent refuses and reminds the user to switch to `RickBuild`

### Requirement: RickPlan bash access is restricted to exploration and scoped GitHub issue commands

The system SHALL configure `RickPlan` shell access through an explicit OpenCode native permission allow-list for read-only exploration commands, OpenSpec commands, and scoped GitHub issue workflows. Shell commands outside that allow-list are denied by the platform.

#### Scenario: RickPlan can run git commands

- **WHEN** `RickPlan` runs shell commands matching the allowed read-only git workflow
- **THEN** the commands are allowed without prompting

#### Scenario: RickPlan can run search commands

- **WHEN** `RickPlan` runs shell commands matching the allowed repository search workflow
- **THEN** the commands are allowed without prompting

#### Scenario: RickPlan can run file reading commands

- **WHEN** `RickPlan` runs shell commands matching the allowed file-inspection workflow
- **THEN** the commands are allowed without prompting

#### Scenario: RickPlan can run openspec commands

- **WHEN** `RickPlan` runs shell commands matching the allowed OpenSpec workflow
- **THEN** the commands are allowed without prompting

#### Scenario: RickPlan can run scoped GitHub issue workflow commands

- **WHEN** `RickPlan` runs shell commands matching the allowed GitHub issue and label workflow
- **THEN** the commands are allowed without prompting

#### Scenario: RickPlan cannot run arbitrary commands

- **WHEN** `RickPlan` attempts to run a shell command outside the allow-list
- **THEN** the command is denied by the agent permission configuration

### Requirement: Rick persona agents receive explicit handoff framing on switch

The system SHALL provide runtime handoff framing to Rick persona primary agents only when the current user turn is handled by a different effective agent than the one that handled the previous completed user turn.

#### Scenario: RickPlan reviews RickBuild output without becoming RickBuild

- **WHEN** the user switches from `RickBuild` to `RickPlan` in the same session
- **THEN** `RickPlan` receives runtime context identifying itself as the current agent
- **AND** the context identifies `RickBuild` as the previous agent when available
- **AND** `RickPlan` treats prior assistant messages as historical outputs to analyze rather than as its own identity

#### Scenario: RickBuild resumes implementation after planning

- **WHEN** the user switches from `RickPlan` to `RickBuild` in the same session
- **THEN** `RickBuild` receives runtime context identifying itself as the current agent
- **AND** the context treats the prior planning responses as historical guidance rather than as the active role

#### Scenario: Transient selector changes do not create a fake handoff

- **WHEN** the previous completed user turn was handled by `plan`
- **AND** the user temporarily selects other agents before returning to `plan` for the next user message
- **THEN** the next `plan` turn is treated as continuing the same effective agent
- **AND** no previous-agent handoff framing is injected

### Requirement: Rick persona agents are model-aware at runtime

The system SHALL provide Rick persona agents with runtime model awareness for the active turn without requiring model pinning in agent frontmatter.

#### Scenario: RickPlan knows the active model

- **WHEN** `RickPlan` receives a user turn and model metadata is available
- **THEN** the runtime context includes the current provider/model identifier for that turn

#### Scenario: RickBuild knows the active model

- **WHEN** `RickBuild` receives a user turn and model metadata is available
- **THEN** the runtime context includes the current provider/model identifier for that turn

### Requirement: Agent files are self-contained

Each shared Rick agent markdown file SHALL contain the complete persona content inline. The persona MUST NOT be referenced via `{file:...}` syntax or any other external reference mechanism.

#### Scenario: RickBuild contains full persona

- **WHEN** the shared `RickBuild` agent file is read
- **THEN** the file contains the complete Rick Sanchez persona (personality, coding philosophy, behavior, code review style, communication rules, agent rules)

#### Scenario: RickPlan contains full persona plus plan override

- **WHEN** the shared `RickPlan` agent file is read
- **THEN** the file contains the complete Rick Sanchez persona plus an additional plan-mode override section that explicitly forbids code writing and directs the agent to analyze, plan, and recommend only

### Requirement: Agents inherit the active model

Agent files SHALL NOT pin a specific model. Both `RickBuild` and `RickPlan` MUST inherit whatever model is currently configured in the session.

#### Scenario: No model specified in frontmatter

- **WHEN** `agents/RickBuild.md` or `agents/RickPlan.md` frontmatter is parsed
- **THEN** no `model` field is present, and the agent uses the session's active model
