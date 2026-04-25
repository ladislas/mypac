## ADDED Requirements

### Requirement: `/context` separates overall window usage from used-token composition

The `/context` command SHALL present total context-window usage separately from used-token composition so that system, tools, and conversation proportions remain legible even when most of the window is still free.

#### Scenario: TUI output keeps small used segments visible

- **WHEN** `/context` renders in the TUI and the free portion of the context window is much larger than the used portion
- **THEN** the view shows overall window usage
- **AND** it also shows a separate used-token breakdown that makes system, tools, and conversation proportions visible without scaling them against the full free space

#### Scenario: Plain-text output keeps the same distinction

- **WHEN** `/context` runs without UI rendering
- **THEN** the output distinguishes the total window-usage summary from the used-token breakdown summary

### Requirement: `/context` uses distinct labels for system-prompt contribution and agent files

The `/context` command SHALL label system-prompt contribution and discovered agent files as separate concepts.

#### Scenario: System summary does not reuse the agent-file list label

- **WHEN** `/context` reports system-prompt usage derived from agent files
- **THEN** the system summary uses wording that distinguishes injected contribution from the file list itself

#### Scenario: Agent files remain visible as a separate source list

- **WHEN** `/context` finds one or more AGENTS or CLAUDE files in scope
- **THEN** it lists those files under a separate agent-file label rather than reusing the same label as the system summary

### Requirement: `/context` reports approximate token counts for loaded skills

The `/context` command SHALL show approximate token counts for skills that are currently loaded into context.

#### Scenario: Loaded skills show usage estimates

- **WHEN** one or more skills have been loaded into the current session
- **THEN** `/context` shows each loaded skill with an approximate token count

#### Scenario: Unloaded skills are not presented as consuming current skill tokens

- **WHEN** a skill is available but has not been loaded into the current session
- **THEN** `/context` does not present that skill as having an active token count in the current context
