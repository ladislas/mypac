## ADDED Requirements

### Requirement: Quick task capture creates a GitHub issue in the current repository

The system SHALL provide a repo-local `/add-task` command that creates a GitHub issue in the current repository from user-supplied task text.

#### Scenario: User captures a simple task in one line

- **WHEN** the user runs `/add-task` with a short task description
- **THEN** the command creates a GitHub issue in the current repository using that description as the issue title

#### Scenario: No input provided

- **WHEN** the user runs `/add-task` without any arguments
- **THEN** the command asks the user to describe the task before proceeding

### Requirement: Created issues are labeled for future triage

The system SHALL ensure that every issue created through `/add-task` includes the `needs triage` label.

#### Scenario: Required label already exists

- **WHEN** the user creates an issue through `/add-task` and the `needs triage` label already exists in the repository
- **THEN** the command creates the issue with the `needs triage` label applied

#### Scenario: Required label does not yet exist

- **WHEN** the user creates an issue through `/add-task` and the `needs triage` label does not exist in the repository
- **THEN** the command creates the label before creating the issue
- **AND** the created issue includes the `needs triage` label

### Requirement: Larger tasks can collect structured context before issue creation

The system SHALL support a guided issue-creation flow for larger tasks or stories so the created issue contains enough context for future execution.

#### Scenario: Input looks like a larger task

- **WHEN** the user provides input that indicates a larger task, story, or multi-part piece of work
- **THEN** the command asks focused follow-up questions before creating the issue
- **AND** the issue body includes the collected context in a structured format

### Requirement: The command preserves a low-friction path for simple tasks

The system SHALL avoid unnecessary follow-up prompts when the provided task appears simple enough for immediate capture.

#### Scenario: Input looks like a simple task

- **WHEN** the user provides a short, single-purpose task description
- **THEN** the command creates the issue without requiring additional follow-up questions

### Requirement: Issue creation failures are actionable

The system SHALL report GitHub CLI or repository errors clearly when it cannot create the requested issue.

#### Scenario: GitHub CLI cannot create the issue

- **WHEN** `/add-task` fails because `gh` is unavailable, unauthenticated, or lacks required repository permissions
- **THEN** the command stops without claiming success
- **AND** the user sees an error that indicates why issue creation failed
