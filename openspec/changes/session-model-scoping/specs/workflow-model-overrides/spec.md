## ADDED Requirements

### Requirement: Workflow helper model calls preserve session and default state

A workflow that uses a dedicated model or thinking level for an internal helper task SHALL be able to do so without changing the caller's active session state or the saved repo/global defaults.

#### Scenario: Internal helper task uses dedicated model state

- **WHEN** a workflow performs a bounded helper task with its own selected model and thinking level
- **THEN** that helper task SHALL run on the workflow-selected model and thinking level
- **AND** the caller's active session model and thinking level SHALL remain unchanged after the helper task completes
- **AND** the saved repo/global defaults SHALL remain unchanged

### Requirement: Workflow-created sessions can start with chosen model state

A workflow that starts or switches into a dedicated workflow session SHALL be able to seed that session with a specific active model and thinking level without rewriting repo/global defaults.

#### Scenario: Review workflow starts on workflow-selected session state

- **WHEN** a review workflow creates or switches into a dedicated review session with a chosen model and thinking level
- **THEN** the review session SHALL start with that chosen model and thinking level as its active session state
- **AND** the originating session's active model and thinking level SHALL remain unchanged
- **AND** the saved repo/global defaults SHALL remain unchanged

### Requirement: Workflow model selection is explicit in workflow behavior

When a workflow uses a model other than the caller's current session model, the workflow SHALL do so through an explicit workflow policy or user choice rather than by silently mutating shared defaults.

#### Scenario: Workflow uses an explicit override policy

- **WHEN** a workflow is configured or coded to prefer a specific model or thinking level for a specific task
- **THEN** the workflow SHALL apply that preference only to the workflow task or workflow session it is creating
- **AND** it SHALL not repurpose that preference as a repo/global default change
