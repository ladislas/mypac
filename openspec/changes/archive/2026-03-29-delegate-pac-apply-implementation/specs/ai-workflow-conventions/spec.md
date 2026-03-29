## MODIFIED Requirements

### Requirement: Repository preserves human-in-the-loop workflow

The repository SHALL describe OpenSpec as a human-guided workflow where proposal, design, specs, and tasks support implementation without replacing code review, manual edits, or incremental decision-making. When `/pac-apply` is used for implementation, the main agent SHALL remain responsible for reading context, selecting the next task or small coherent batch, reviewing delegated results, and deciding whether to continue or pause.

#### Scenario: Reader wants guided, not autonomous, implementation

- **WHEN** a reader consults the OpenSpec workflow guidance
- **THEN** they understand that humans stay in control of implementation and review rather than delegating the entire change end-to-end
- **AND** they understand that `/pac-apply` keeps orchestration and pause decisions in the main agent context

## ADDED Requirements

### Requirement: Repository defines scoped delegated `/pac-apply` execution

The repository SHALL document that `/pac-apply` performs implementation by delegating the selected task or small coherent batch to the general subagent through the actual task-execution harness, while the main agent continues to orchestrate the overall change.

#### Scenario: Reader uses `/pac-apply` for the next implementation slice

- **WHEN** a reader follows `/pac-apply` guidance to execute pending work
- **THEN** the guidance tells them to delegate only the current task or small coherent batch to the general subagent
- **AND** the guidance does not describe whole-change autonomous delegation

#### Scenario: Reader looks for delegation syntax

- **WHEN** a reader checks how `/pac-apply` describes delegated execution
- **THEN** the guidance uses actual harness or tool terminology for the general subagent
- **AND** the guidance avoids invented syntax that does not match the runtime environment
