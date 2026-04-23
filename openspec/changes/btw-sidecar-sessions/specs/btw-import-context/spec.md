## ADDED Requirements

### Requirement: BTW exposes an explicit import action while staying isolated by default

The BTW overlay SHALL expose an explicit `Import context` action from within the overlay, and `/btw` SHALL remain isolated from the main session until the user triggers that action.

#### Scenario: Opening BTW without importing context

- **WHEN** the user opens `/btw`
- **THEN** the overlay shows BTW's normal isolated side conversation state
- **AND** the overlay exposes an `Import context` action alongside the other overlay actions
- **AND** BTW does not include main-session context unless the user imports it

### Requirement: BTW records an open-time anchor for first import

The system SHALL capture a main-session anchor when BTW opens without automatically importing main-session context.

#### Scenario: First import uses the main-session state from BTW launch time

- **WHEN** BTW was opened, the main session later changes, and the user performs the first explicit import
- **THEN** the imported snapshot is resolved from the main-session state anchored at BTW launch time rather than from the later current state

### Requirement: BTW supports explicit refresh of imported main-session context

The system SHALL let users explicitly replace the active imported snapshot after the first import.

#### Scenario: Refresh import uses current main-session state

- **WHEN** BTW already has an imported main-session snapshot and the user explicitly refreshes or re-imports context
- **THEN** the system resolves a new snapshot from the current main-session state
- **AND** replaces the previously active imported snapshot for future BTW prompts

### Requirement: Imported main-session context is frozen, visible, and sidecar-owned

The system SHALL persist imported main-session context as a frozen snapshot in the BTW sidecar and make its presence visible in the BTW UI.

#### Scenario: Imported snapshot stays frozen until explicit refresh or reset

- **WHEN** BTW has an active imported main-session snapshot
- **THEN** BTW continues using that same snapshot for later prompts until the user explicitly refreshes/re-imports or resets BTW

#### Scenario: BTW UI indicates that imported context is active

- **WHEN** BTW has an active imported main-session snapshot
- **THEN** the BTW UI shows that imported context is active
- **AND** indicates that the context was explicitly imported rather than automatically shared

### Requirement: Imported main-session content is filtered and treated as ordinary BTW history

The system SHALL import a conversationally useful snapshot of main-session context without promoting it to system-level instructions.

#### Scenario: Import keeps useful conversational context but omits raw execution noise

- **WHEN** the system builds an imported main-session snapshot for BTW
- **THEN** it includes user questions, assistant answers, compaction summaries, branch summaries, and compact relevant tool context when needed
- **AND** it excludes raw tool-result bodies and live execution output from the imported snapshot

#### Scenario: Imported snapshot is not treated as system-prompt instruction

- **WHEN** imported main-session content is included in BTW prompt context
- **THEN** that imported content is represented as ordinary BTW conversation/history content
- **AND** it is not elevated to BTW system-prompt instructions

### Requirement: BTW-to-main handoff remains explicit

The system SHALL keep BTW-to-main transfer explicit rather than automatically merging BTW history into the main session.

#### Scenario: BTW summary is injected into main only by explicit action

- **WHEN** a user wants BTW output to appear in the main session
- **THEN** the transfer happens only through an explicit inject or summary action
- **AND** BTW history is not automatically merged into the main session transcript
