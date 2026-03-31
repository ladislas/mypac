## ADDED Requirements

### Requirement: Standard review command exists

The system SHALL provide a `/pac-review` command that performs a structured review of the current change context and returns a report focused on correctness, scope, maintainability, and verification gaps.

#### Scenario: User requests a standard review

- **WHEN** the user runs `/pac-review`
- **THEN** the system performs a standard review of the current branch or change context
- **AND** returns a structured review report rather than implementing fixes

### Requirement: Adversarial review command exists

The system SHALL provide a `/pac-review-adversarial` command that performs a skeptical independent review of the same change context and emphasizes hidden assumptions, subtle failure modes, and false confidence.

#### Scenario: User requests an adversarial review

- **WHEN** the user runs `/pac-review-adversarial`
- **THEN** the system performs an adversarial review of the current branch or change context
- **AND** returns a structured review report that pressure-tests the change rather than merely restating the happy path

### Requirement: Review workflows run in fresh delegated context

Both review commands SHALL perform their main review work through a fresh delegated subagent context so the main thread stays focused and prior reasoning is not automatically reused.

#### Scenario: Standard review uses delegated isolation

- **WHEN** the user runs `/pac-review`
- **THEN** the system launches the review in fresh delegated context
- **AND** returns only the resulting review report to the main thread

#### Scenario: Adversarial review uses delegated isolation

- **WHEN** the user runs `/pac-review-adversarial`
- **THEN** the system launches the review in fresh delegated context
- **AND** does not perform the main review inline in the main thread

### Requirement: Review target context is normalized before delegation

Both review workflows SHALL derive a normalized review target from the current change context before delegated execution so the standard and adversarial passes reason about the same source material.

#### Scenario: Shared review target is prepared

- **WHEN** the user runs `/pac-review` or `/pac-review-adversarial`
- **THEN** the system derives review target context from the current diff or change target
- **AND** includes relevant base-branch, OpenSpec, and explicit user-focus context when available before delegation

### Requirement: Review reports include scope and intent checks when context exists

When sufficient intent context exists, the review workflows SHALL report whether the delivered change appears aligned, drifted, or incomplete relative to the stated goal before listing detailed findings.

#### Scenario: Review can compare intent to delivered change

- **WHEN** the system has enough context from user input, branch context, or OpenSpec artifacts to infer the intended change
- **THEN** the review report includes a scope or intent summary ahead of detailed findings
- **AND** flags likely drift or missing requirement coverage when detected

### Requirement: Adversarial review remains independent from prior findings

The adversarial review workflow SHALL derive its findings from the source change context and MUST NOT receive prior standard-review findings as review input.

#### Scenario: Adversarial review does not inherit standard review conclusions

- **WHEN** a standard review has already been run in the current session
- **AND** the user later runs `/pac-review-adversarial`
- **THEN** the adversarial review receives the branch, diff, and relevant change context
- **AND** does not receive the earlier standard review findings as input

### Requirement: Review reports use a shared core structure

Both review workflows SHALL return reports with a shared core structure containing status, summary, scope, findings, verification gaps, and recommended next actions so results can be compared consistently.

#### Scenario: Standard review returns structured output

- **WHEN** `/pac-review` completes
- **THEN** the response includes the shared core report sections

#### Scenario: Adversarial review returns compatible structured output

- **WHEN** `/pac-review-adversarial` completes
- **THEN** the response includes the shared core report sections
- **AND** may include adversarial-specific emphasis such as likely failure modes without breaking structural compatibility

### Requirement: Adversarial review can accept explicit model selection

The adversarial review workflow SHALL support an explicit model-selection argument when the runtime supports routed or overridden model execution.

#### Scenario: User requests a specific adversarial model

- **WHEN** the user runs `/pac-review-adversarial` with an explicit model argument
- **AND** the runtime supports model-specific execution for the delegated review
- **THEN** the adversarial review uses the requested model for that delegated run

#### Scenario: Runtime cannot honor requested model

- **WHEN** the user runs `/pac-review-adversarial` with an explicit model argument
- **AND** the runtime cannot honor that model request
- **THEN** the system reports the limitation clearly instead of silently pretending the override worked

### Requirement: Repository documents stronger-independence guidance

The repository SHALL document that running `/pac-review-adversarial` in a fresh session is the recommended path when the user wants the strongest practical independence from earlier review context.

#### Scenario: User checks review workflow guidance

- **WHEN** a user reads the review workflow documentation
- **THEN** the guidance explains that fresh delegated context is the default
- **AND** recommends a new session for maximum independence when needed
