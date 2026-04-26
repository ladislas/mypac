## MODIFIED Requirements

### Requirement: Repository records OpenSpec artifact retention

The repository SHALL state that meaningful OpenSpec artifacts are committed when they preserve rationale, review context, or implementation history, and that archived OpenSpec change trails are retained only when they remain safe and useful as repository context for humans and agents.

#### Scenario: Reader decides whether to commit artifacts

- **WHEN** a reader completes a non-trivial change with OpenSpec artifacts
- **THEN** the repository guidance tells them those artifacts are expected to be committed when they capture durable context

#### Scenario: Reader reviews archived OpenSpec changes

- **WHEN** a reader evaluates whether an archived OpenSpec change should remain in the repository
- **THEN** the repository guidance tells them to keep it only if it remains useful without materially misleading humans or agents about the current supported workflow
- **AND** the guidance allows removing archived change trails whose main content is deprecated or unsupported behavior
