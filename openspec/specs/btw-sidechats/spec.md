## ADDED Requirements

### Requirement: BTW state is persisted in a dedicated linked sidechat session

The system SHALL persist BTW state in a dedicated sidechat session file instead of storing BTW persistence entries in the main session transcript.

#### Scenario: Opening BTW creates or reuses a linked sidechat

- **WHEN** a user opens `/btw` from a main session
- **THEN** the system creates a BTW sidechat for that main session if one does not exist
- **AND** reuses the existing BTW sidechat if one is already linked to that same main session

#### Scenario: Main session transcript remains free of BTW persistence state

- **WHEN** BTW messages, resets, or imported snapshots are persisted
- **THEN** that persisted BTW state is written to the BTW sidechat session
- **AND** the main session file is not used as BTW's long-term persistence store

### Requirement: BTW sidechat scope follows main session identity

The system SHALL expose one BTW sidechat per main session for the first pass.

#### Scenario: Branch navigation within one main session reuses the same BTW sidechat

- **WHEN** a user navigates between branches inside the same main session file and reopens `/btw`
- **THEN** the system reuses the same BTW sidechat linked to that main session

#### Scenario: A fresh main session gets a fresh BTW sidechat

- **WHEN** a user starts a new main session or switches to a different main session file and opens `/btw`
- **THEN** the system uses a BTW sidechat linked to that new main session file rather than reusing the previous session's BTW sidechat

#### Scenario: Forked or cloned sessions do not inherit the previous main session's BTW sidechat

- **WHEN** a user creates a forked or cloned main session and opens `/btw`
- **THEN** the system creates or uses a BTW sidechat linked to the new main session file
- **AND** it does not automatically reuse the BTW sidechat from the source main session

### Requirement: BTW sidechats are hidden from normal session browsing

The system SHALL store BTW sidechats in a hidden location under the project session directory so they do not appear as normal resumable sessions.

#### Scenario: BTW sidechats do not appear in normal session lists

- **WHEN** a user browses or resumes normal sessions for the project
- **THEN** BTW sidechat files are not shown as ordinary sessions alongside main sessions

#### Scenario: Removing a BTW sidechat does not require editing the main session file

- **WHEN** a BTW sidechat file is removed while the main session file still exists
- **THEN** the main session transcript remains unchanged
- **AND** opening `/btw` again starts from a fresh BTW sidechat for that main session
