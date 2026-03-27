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

The system SHALL deny the `edit` permission entirely for `RickPlan`. The edit tool MUST NOT be available to the agent.

#### Scenario: RickPlan cannot edit files

- **WHEN** `RickPlan` attempts to use the edit tool
- **THEN** the tool is not available (denied at permission level, not just prompted)

#### Scenario: RickPlan prompt reinforces no-code policy

- **WHEN** the user asks `RickPlan` to write or modify code
- **THEN** the agent refuses and reminds the user to switch to `RickBuild`

### Requirement: RickPlan bash access is restricted to exploration and scoped GitHub issue commands

The system SHALL configure `RickPlan` bash permissions with a default deny and an explicit allow-list of local read-only exploration commands plus scoped GitHub issue and label operations for planning continuity.

#### Scenario: RickPlan can run git commands

- **WHEN** `RickPlan` runs bash commands matching `git status*`, `git diff*`, `git log*`, `git show*`, `git branch*`, `git rev-parse*`, or `git ls-files*`
- **THEN** the commands are allowed without prompting

#### Scenario: RickPlan can run search commands

- **WHEN** `RickPlan` runs bash commands matching `grep *` or `rg *`
- **THEN** the commands are allowed without prompting

#### Scenario: RickPlan can run file reading commands

- **WHEN** `RickPlan` runs bash commands matching `head *`, `tail *`, `ls *`, `tree *`, `wc *`, or `file *`
- **THEN** the commands are allowed without prompting

#### Scenario: RickPlan can run openspec commands

- **WHEN** `RickPlan` runs bash commands matching `openspec *`
- **THEN** the commands are allowed without prompting

#### Scenario: RickPlan can run scoped GitHub issue workflow commands

- **WHEN** `RickPlan` runs bash commands matching `gh auth status*`, `gh repo view*`, `gh issue list*`, `gh issue view*`, `gh issue create*`, `gh issue edit*`, `gh issue close*`, `gh label list*`, or `gh label create "needs triage"*`
- **THEN** the commands are allowed without prompting

#### Scenario: RickPlan cannot run arbitrary commands

- **WHEN** `RickPlan` attempts to run a bash command not in the allow-list (e.g., `rm`, `npm`, `mkdir`, `echo >`, `gh pr create`)
- **THEN** the command is denied

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

- **WHEN** `.opencode/agents/RickBuild.md` or `.opencode/agents/RickPlan.md` frontmatter is parsed
- **THEN** no `model` field is present, and the agent uses the session's active model
