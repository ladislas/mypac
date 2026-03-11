# ADR-0001: Default Interface is OpenCode

## Status

Accepted

## Context

- I value provider portability and model swapping.
- The interface/harness has more impact than the model alone.
- I want a stable daily workflow with optional specialist tools.

## Decision

- Use OpenCode as the default interface.
- Treat Claude Code and Codex as specialist tools.

## Alternatives considered

- **Claude Code** — strong coding capability but tightly coupled to Anthropic; less portable across providers.
- **Cursor** — IDE-embedded; good UX but locks workflow into a specific editor and subscription model.
- **Aider** — open source, terminal-based, provider-agnostic; viable but less polished for agentic multi-step tasks at the time of this decision.
- **Cline / Roo** — VS Code extension; similar portability to OpenCode but more IDE-dependent.

OpenCode was chosen because it offers provider portability, a stable CLI/config model, and supports subagent routing (explore/general roles) that matches the routing strategy.

## Consequences

- Primary workflow is stable and swappable across providers.
- Specialist tools are used only for edge cases.
- Specific model choices can change without reopening this decision.

## Review

- Revisit if a competing harness beats OpenCode on quality and cost.
