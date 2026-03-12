# ai-workflow-conventions Specification

## Purpose

Define the repository's AI workflow conventions, including how OpenSpec is used, when its artifacts are expected, and how humans stay in control of planning and implementation.

## Requirements

### Requirement: Repository documents OpenSpec usage model

The repository SHALL explain that OpenSpec is typically installed as a machine-level CLI while each repository is initialized and operated independently.

#### Scenario: Reader wants to understand setup scope

- **WHEN** a reader looks for OpenSpec setup guidance in the repository
- **THEN** they can tell the difference between CLI installation on a machine and project-level initialization inside a repository

### Requirement: Repository defines when to use OpenSpec

The repository SHALL document that OpenSpec is the default planning workflow for meaningful multi-step changes and is optional for trivial or obvious edits.

#### Scenario: Reader decides whether a task needs OpenSpec

- **WHEN** a reader evaluates a planned change
- **THEN** they can determine from the repository guidance whether to use OpenSpec or skip it for that task

### Requirement: Repository records OpenSpec artifact retention

The repository SHALL state that meaningful OpenSpec artifacts are committed when they preserve rationale, review context, or implementation history.

#### Scenario: Reader decides whether to commit artifacts

- **WHEN** a reader completes a non-trivial change with OpenSpec artifacts
- **THEN** the repository guidance tells them those artifacts are expected to be committed when they capture durable context

### Requirement: Repository preserves human-in-the-loop workflow

The repository SHALL describe OpenSpec as a human-guided workflow where proposal, design, specs, and tasks support implementation without replacing code review, manual edits, or incremental decision-making.

#### Scenario: Reader wants guided, not autonomous, implementation

- **WHEN** a reader consults the OpenSpec workflow guidance
- **THEN** they understand that humans stay in control of implementation and review rather than delegating the entire change end-to-end
