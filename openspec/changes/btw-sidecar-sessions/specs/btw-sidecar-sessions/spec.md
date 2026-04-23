## ADDED Requirements

### Requirement: BTW state is persisted in a dedicated linked sidecar session

The system SHALL persist BTW state in a dedicated sidecar session file instead of storing BTW persistence entries in the main session transcript.

#### Scenario: Opening BTW creates or reuses a linked sidecar

- **WHEN** a user opens `/btw` from a main session
- **THEN** the system creates a BTW sidecar for that main session if one does not exist
- **AND** reuses the existing BTW sidecar if one is already linked to that same main session

#### Scenario: Main session transcript remains free of BTW persistence state

- **WHEN** BTW messages, resets, or imported snapshots are persisted
- **THEN** that persisted BTW state is written to the BTW sidecar session
- **AND** the main session file is not used as BTW's long-term persistence store

### Requirement: BTW sidecar scope follows main session identity

The system SHALL expose one BTW sidecar per main session for the first pass.

#### Scenario: Branch navigation within one main session reuses the same BTW sidecar

- **WHEN** a user navigates between branches inside the same main session file and reopens `/btw`
- **THEN** the system reuses the same BTW sidecar linked to that main session

#### Scenario: A fresh main session gets a fresh BTW sidecar

- **WHEN** a user starts a new main session or switches to a different main session file and opens `/btw`
- **THEN** the system uses a BTW sidecar linked to that new main session file rather than reusing the previous session's BTW sidecar

#### Scenario: Forked or cloned sessions do not inherit the previous main session's BTW sidecar

- **WHEN** a user creates a forked or cloned main session and opens `/btw`
- **THEN** the system creates or uses a BTW sidecar linked to the new main session file
- **AND** it does not automatically reuse the BTW sidecar from the source main session

### Requirement: BTW sidecars are hidden from normal session browsing

The system SHALL store BTW sidecars in a hidden location under the project session directory so they do not appear as normal resumable sessions.

#### Scenario: BTW sidecars do not appear in normal session lists

- **WHEN** a user browses or resumes normal sessions for the project
- **THEN** BTW sidecar files are not shown as ordinary sessions alongside main sessions

#### Scenario: Removing a BTW sidecar does not require editing the main session file

- **WHEN** a BTW sidecar file is removed while the main session file still exists
- **THEN** the main session transcript remains unchanged
- **AND** opening `/btw` again starts from a fresh BTW sidecar for that main session

### Requirement: Existing inline BTW history migrates into the sidecar model

The system SHALL preserve existing persisted BTW history from the legacy inline model on a best-effort basis.

#### Scenario: Legacy inline BTW entries are recovered into a new sidecar

- **WHEN** a main session contains legacy inline BTW persistence entries and no BTW sidecar exists yet
- **THEN** opening or restoring BTW reconstructs the persisted BTW history from those legacy entries
- **AND** persists the recovered BTW state into the new BTW sidecar
