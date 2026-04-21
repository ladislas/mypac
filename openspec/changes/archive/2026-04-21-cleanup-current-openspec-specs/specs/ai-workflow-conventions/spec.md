## MODIFIED Requirements

### Requirement: Repository preserves human-in-the-loop workflow

The repository SHALL describe OpenSpec as a human-guided workflow where proposal, design, specs, and tasks support implementation without replacing code review, manual edits, or incremental decision-making. When `/pac-apply` is used for implementation, the main agent SHALL remain responsible for reading context, selecting the next task or small coherent batch, implementing the scoped work, reviewing results, verifying the outcome, and deciding whether to continue or pause.

#### Scenario: Reader wants guided, not autonomous, implementation

- **WHEN** a reader consults the OpenSpec workflow guidance
- **THEN** they understand that humans stay in control of implementation and review rather than delegating the entire change end-to-end
- **AND** they understand that `/pac-apply` keeps orchestration, implementation, verification, and pause decisions in the main agent context

## ADDED Requirements

### Requirement: Repository defines scoped `/pac-apply` execution in the main agent context

The repository SHALL document that `/pac-apply` executes the selected task or small coherent batch in the main agent context while the overall change continues to be orchestrated incrementally.

#### Scenario: Reader uses `/pac-apply` for the next implementation slice

- **WHEN** a reader follows `/pac-apply` guidance to execute pending work
- **THEN** the guidance tells them to work on only the current task or small coherent batch
- **AND** the guidance does not describe whole-change autonomous execution

#### Scenario: Reader looks for execution model details

- **WHEN** a reader checks how `/pac-apply` describes implementation
- **THEN** the guidance states that the main agent performs the scoped implementation directly
- **AND** the guidance avoids promising delegated subagent execution that does not match the runtime environment

## REMOVED Requirements

### Requirement: Repository defines scoped delegated `/pac-apply` execution

**Reason**: The current repository guidance no longer describes `/pac-apply` as delegated subagent execution through a task-execution harness.

**Migration**: Use the new main-agent execution requirement for `/pac-apply` behavior and verify it against the current prompt and skill guidance.
