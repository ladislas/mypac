## Why

The repo now has better runtime awareness for active agents and models, but it still lacks a first-class way to review work before implementation or shipping. Adding dedicated review workflows now will turn that runtime metadata into something useful: a standard self-review pass and an independent adversarial pass that can challenge false confidence and catch issues a single review might miss.

## What Changes

- Keep `/pac-review` as a thin user-facing workflow for structured pre-implementation or pre-ship review of the current change context.
- Keep `/pac-review-adversarial` as a thin user-facing workflow for an independent skeptical review that runs in fresh delegated context and is designed to pressure-test the same change.
- Add `/pac-review-mixed` as a thin user-facing workflow that runs standard and adversarial reviews in parallel, then returns an explicit synthesized comparison and verdict.
- Incorporate lessons from existing review references, especially OpenCode's built-in `/review` command shape, the gstack review workflow, and the comprehensive-review plugin patterns, while keeping this repo's workflow smaller and analysis-only.
- Define shared review output structure so both workflows report scope, findings, verification gaps, and recommended next actions consistently.
- Add review target normalization and intent-aware scope checking so review can reason about what was supposed to be built before listing findings.
- Define explicit packet-derivation rules for branch, base branch, diff source, and active OpenSpec context so both lanes start from the same observable input.
- Move detailed reviewer rules and review-context framing into delegated reviewer prompt assets so main-thread command text stays small.
- Support delegated review execution through fresh subagents so the main thread stays clean and the adversarial pass has stronger practical independence.
- Prefer command-level model configuration or routing for adversarial review, with honest fallback behavior when the preferred route is unavailable.
- Define degraded-mode behavior for cases where delegation freshness, parallelism, or preferred routing cannot be verified at runtime.
- Document recommended usage patterns, including running the adversarial review in a fresh session when maximum independence is desired.

## Capabilities

### New Capabilities

- `review-workflows`: Define the command and workflow behavior for standard, adversarial, and mixed review passes, including independent delegated execution, explicit comparison, and structured reporting.

### Modified Capabilities

## Impact

- New review command definitions under `commands/`.
- New reusable review workflow skills or equivalent review prompt assets under `skills/`.
- Review orchestration that delegates work to fresh subagents and supports explicit mixed-review comparison in the main thread.
- Command-level routing or preferred model configuration for adversarial review rather than per-invocation override claims that cannot be enforced reliably.
- Review target discovery and scope or intention auditing derived from the current diff, user input, and relevant OpenSpec context.
- Runtime-honesty rules that downgrade confidence when packet derivation, delegated freshness, parallelism, or preferred routing cannot be proven.
- Documentation updates covering review usage, model-routing expectations, and recommended independence practices.
