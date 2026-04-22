## ADDED Requirements

### Requirement: BTW exposes an explicit import action while staying isolated by default

The BTW overlay SHALL expose an explicit `Import context` action from within the overlay, and `/btw` SHALL remain isolated from the main session until the user triggers that action.

#### Scenario: Opening BTW without importing context

- **WHEN** the user opens `/btw`
- **THEN** the overlay shows BTW's normal isolated side conversation state
- **AND** the overlay exposes an `Import context` action alongside the other overlay actions
- **AND** BTW does not include main-session context unless the user imports it

### Requirement: BTW imports a frozen main-session snapshot on demand

When the user triggers `Import context`, BTW SHALL capture a snapshot of the resolved current main-session context and SHALL use that snapshot for subsequent BTW prompts until the user refreshes it or resets BTW.

#### Scenario: Imported context remains frozen after import

- **WHEN** the user imports main-session context into BTW
- **AND** the main session later receives new messages or tool activity
- **THEN** BTW continues using the previously imported snapshot
- **AND** BTW does not stream later main-session updates into the side chat automatically

#### Scenario: Re-import refreshes BTW context

- **WHEN** BTW already has imported context
- **AND** the user triggers `Import context` again after the main session changes
- **THEN** BTW replaces the previously imported snapshot with a new frozen snapshot
- **AND** subsequent BTW prompts use the refreshed imported context

### Requirement: Imported context preserves conversation signal without raw execution noise

BTW SHALL build imported context from the resolved main-session conversation and SHALL preserve conversationally relevant text while avoiding raw execution-output dumps.

#### Scenario: Import keeps user and assistant discussion context

- **WHEN** the main session contains user questions, assistant answers, compaction summaries, or branch summaries relevant to the current work
- **THEN** BTW imports that context as part of the frozen snapshot

#### Scenario: Import keeps compact tool context without raw tool results

- **WHEN** the main session discussion depends on recent tool usage
- **THEN** BTW imports compact summaries of relevant tool calls
- **AND** BTW does not import raw tool-result bodies or live streaming execution output as part of the imported snapshot

### Requirement: BTW shows imported context explicitly in the overlay

BTW SHALL make imported context visible inside the BTW overlay so users can tell that main-session context was imported intentionally.

#### Scenario: Overlay indicates imported context is active

- **WHEN** the user imports main-session context into BTW
- **THEN** the BTW overlay shows an imported-context block or marker in the transcript
- **AND** the marker indicates that the context came from an explicit import rather than automatic live sharing
