# agent-runtime-awareness Specification

## Purpose

Define the shared runtime-awareness plugin behavior for effective agent handoffs, synthetic runtime context, and runtime introspection.

## Requirements

### Requirement: Runtime awareness plugin tracks effective agent handoffs per session

The system SHALL provide a local OpenCode plugin that maintains per-session runtime awareness based on effective conversational turns, including the current agent and the immediately previous effective agent when a real handoff occurs.

#### Scenario: Current agent is tracked from message metadata

- **WHEN** a user sends a message while a primary agent is active
- **THEN** the plugin records that agent as the current agent for the session

#### Scenario: Previous effective agent is preserved across a real handoff

- **WHEN** a new user turn is handled by a different agent than the agent that handled the previous completed user turn in the same session
- **THEN** the plugin records the former effective agent as the previous agent for that session
- **AND** makes the new active agent available as the current agent for subsequent runtime context injection

#### Scenario: Transient agent selection does not create a handoff

- **WHEN** the user temporarily selects one or more different agents but sends the next user message with the same agent that handled the previous completed user turn
- **THEN** the plugin does not record a handoff for that turn
- **AND** does not inject previous-agent handoff context

### Requirement: Runtime context announces identity, handoff, and model

The system SHALL inject synthetic runtime context into chat turns so the active agent can identify its current agent role, current model, and handoff relationship to prior assistant messages.

#### Scenario: Runtime context identifies the active agent

- **WHEN** the active agent receives a new user turn
- **THEN** the synthetic runtime context states which agent is currently operating for that session

#### Scenario: Runtime context frames prior assistant messages after a real handoff

- **WHEN** the active agent differs from the agent that handled the previous completed user turn in the same session
- **THEN** the synthetic runtime context instructs the model to treat prior assistant messages as historical outputs rather than as the current agent identity

#### Scenario: Runtime context omits handoff when the effective agent is unchanged

- **WHEN** the active agent matches the agent that handled the previous completed user turn in the same session
- **THEN** the synthetic runtime context does not announce a previous-agent handoff

#### Scenario: Runtime context announces the active model

- **WHEN** model metadata is available for the current turn
- **THEN** the synthetic runtime context includes the provider/model identifier for the active model

### Requirement: Runtime introspection tool exposes current session context

The system SHALL provide a runtime introspection tool that returns structured current-session awareness data for meta-agents and reviewer workflows.

#### Scenario: Reviewer agent inspects runtime context

- **WHEN** an agent calls the runtime introspection tool during a session
- **THEN** the tool returns the current agent and previous agent when available
- **AND** includes the active model identifier for the session
