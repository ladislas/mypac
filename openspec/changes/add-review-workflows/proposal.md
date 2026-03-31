## Why

The repo now has better runtime awareness for active agents and models, but it still lacks a first-class way to review work before implementation or shipping. Adding dedicated review workflows now will turn that runtime metadata into something useful: a standard self-review pass and an independent adversarial pass that can challenge false confidence and catch issues a single review might miss.

## What Changes

- Add a `/pac-review` workflow for structured pre-implementation or pre-ship review of the current change context.
- Add a `/pac-review-adversarial` workflow for an independent skeptical review that runs in fresh delegated context and is designed to pressure-test the same change.
- Incorporate lessons from existing review references, especially OpenCode's built-in `/review` command shape, the gstack review workflow, and the comprehensive-review plugin patterns, while keeping this repo's workflow smaller and analysis-only.
- Define shared review output structure so both workflows report scope, findings, verification gaps, and recommended next actions consistently.
- Add review target normalization and intent-aware scope checking so review can reason about what was supposed to be built before listing findings.
- Support delegated review execution through fresh subagents so the main thread stays clean and the adversarial pass has stronger practical independence.
- Allow the adversarial workflow to use a configurable alternate model path or explicit model override when the runtime supports it.
- Document recommended usage patterns, including running the adversarial review in a fresh session when maximum independence is desired.

## Capabilities

### New Capabilities

- `review-workflows`: Define the command and workflow behavior for standard and adversarial review passes, including independent delegated execution and structured reporting.

### Modified Capabilities

## Impact

- New review command definitions under `commands/`.
- New reusable review workflow skills or equivalent review prompt assets under `skills/`.
- Review orchestration that delegates work to fresh subagents and may optionally route adversarial review to a different model.
- Review target discovery and scope or intention auditing derived from the current diff, user input, and relevant OpenSpec context.
- Documentation updates covering review usage, model-routing expectations, and recommended independence practices.
