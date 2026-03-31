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

### Requirement: Mixed review command exists

The system SHALL provide a `/pac-review-mixed` command that runs standard and adversarial reviews for the same change context and returns an explicit synthesized comparison and verdict.

#### Scenario: User requests a mixed review

- **WHEN** the user runs `/pac-review-mixed`
- **THEN** the system launches both a standard review and an adversarial review for the same normalized change context
- **AND** returns a synthesized comparison that includes an overall verdict rather than two unrelated reports

### Requirement: Review workflows run in fresh delegated context

The standard and adversarial review lanes SHALL perform their main review work through a fresh delegated subagent context so the main thread stays focused and prior reasoning is not automatically reused.

#### Scenario: Standard review uses delegated isolation

- **WHEN** the user runs `/pac-review`
- **THEN** the system launches the review in fresh delegated context
- **AND** returns only the resulting review report to the main thread

#### Scenario: Adversarial review uses delegated isolation

- **WHEN** the user runs `/pac-review-adversarial`
- **THEN** the system launches the review in fresh delegated context
- **AND** does not perform the main review inline in the main thread

#### Scenario: Mixed review delegates both lanes

- **WHEN** the user runs `/pac-review-mixed`
- **THEN** the system launches fresh delegated standard and adversarial review lanes
- **AND** performs the comparison after those delegated lanes return

### Requirement: Review target context is normalized before delegation

All review workflows SHALL derive a normalized review target from the current change context before delegation so the standard and adversarial passes reason about the same source material.

#### Scenario: Shared review target is prepared

- **WHEN** the user runs `/pac-review`, `/pac-review-adversarial`, or `/pac-review-mixed`
- **THEN** the system derives review target context from the current diff or change target
- **AND** includes relevant base-branch, OpenSpec, and explicit user-focus context when available before delegation

### Requirement: Packet derivation is evidence-based and explicit

The normalized review target packet SHALL derive branch, base branch, diff source, requested target, and relevant OpenSpec context from observable runtime evidence in a stable order, and SHALL preserve ambiguity instead of guessing when evidence is incomplete.

#### Scenario: Base branch and diff source are inferred from git state

- **WHEN** the user does not provide an explicit review target
- **AND** the current branch and merge base can be observed from git state
- **THEN** the packet records those inferred values as the branch, base branch, and diff source

#### Scenario: Ambiguous context remains explicit

- **WHEN** the workflow cannot confidently infer a packet field such as base branch or active OpenSpec change
- **THEN** the packet leaves that field unknown or ambiguous
- **AND** the resulting review report calls out the missing evidence rather than inventing a confident value

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

### Requirement: Detailed reviewer rules are delegated

The system SHALL keep `/pac-review`, `/pac-review-adversarial`, and `/pac-review-mixed` as thin user-facing commands while placing detailed review rules, report expectations, and lane-specific emphasis in delegated reviewer prompts or equivalent assets.

#### Scenario: Command text stays small while review behavior stays rich

- **WHEN** a user inspects or runs a review command
- **THEN** the command entrypoint remains a concise workflow wrapper
- **AND** the detailed review instructions are supplied through delegated reviewer assets rather than embedded inline in the main-thread command text

### Requirement: Review reports use a shared core structure

Both review workflows SHALL return reports with a shared core structure containing status, summary, scope, findings, verification gaps, and recommended next actions so results can be compared consistently.

#### Scenario: Standard review returns structured output

- **WHEN** `/pac-review` completes
- **THEN** the response includes the shared core report sections

#### Scenario: Adversarial review returns compatible structured output

- **WHEN** `/pac-review-adversarial` completes
- **THEN** the response includes the shared core report sections
- **AND** may include adversarial-specific emphasis such as likely failure modes without breaking structural compatibility

### Requirement: Mixed review comparison is explicit

The `/pac-review-mixed` workflow SHALL produce an explicit comparison that identifies overlapping findings, unique findings, contradictory conclusions, and a synthesized verdict for the reviewed change.

#### Scenario: Mixed review compares both lanes explicitly

- **WHEN** `/pac-review-mixed` completes
- **THEN** the response includes comparison output derived from both reports
- **AND** does not rely on implicit session-state detection of prior independent runs to decide whether comparison should happen

### Requirement: Mixed review reports degraded execution honestly

The `/pac-review-mixed` workflow SHALL report when fresh delegation, parallel lane execution, or adversarial route preference could not be verified, and SHALL lower confidence in the final verdict accordingly.

#### Scenario: Parallelism or delegation cannot be verified

- **WHEN** mixed review cannot verify that both lanes ran in fresh delegated context or in parallel
- **THEN** the final comparison reports the missing guarantee explicitly
- **AND** the mixed verdict does not describe the run as fully independent

### Requirement: Adversarial model routing is honest about guarantees

The adversarial review workflow SHALL prefer configured or command-level model routing when available and MUST clearly disclose when a preferred alternate route could not be honored.

#### Scenario: Preferred adversarial route is available

- **WHEN** the adversarial workflow has configured access to a preferred alternate route
- **THEN** the delegated adversarial review uses that route

#### Scenario: Preferred adversarial route is unavailable

- **WHEN** the adversarial workflow cannot use its preferred alternate route
- **THEN** the system states the limitation clearly
- **AND** does not claim that a stronger model-isolation guarantee was achieved than the runtime actually provided

### Requirement: Routing status semantics are explicit

The review workflows SHALL use explicit route-status semantics so that preferred routing is marked as honored only with positive runtime evidence, as unavailable when the runtime explicitly rejects or bypasses the preferred route, and as unknown when the runtime provides no proof either way.

#### Scenario: Runtime proves route was honored

- **WHEN** the runtime positively identifies that the preferred adversarial route was used
- **THEN** the packet and report mark the route as honored

#### Scenario: Runtime provides no routing proof

- **WHEN** the runtime does not expose enough evidence to prove whether the preferred route was used
- **THEN** the packet and report mark the route status as unknown
- **AND** the review output avoids claiming stronger isolation than can be proven

### Requirement: Repository documents stronger-independence guidance

The repository SHALL document that review workflows are analysis only, that running `/pac-review-adversarial` in a fresh session is the recommended path when the user wants the strongest practical independence from earlier review context, and that `/pac-review-mixed` performs explicit comparison rather than inferring it from thread state.

#### Scenario: User checks review workflow guidance

- **WHEN** a user reads the review workflow documentation
- **THEN** the guidance explains that fresh delegated context is the default
- **AND** recommends a new session for maximum independence when needed
- **AND** explains the analysis-only guardrail and explicit mixed-review comparison behavior
