---
name: pac-review-standard
description: Standard structured review lane for correctness, scope, maintainability, and verification gaps.
license: MIT
---

# Standard Review Lane

Use this asset with `skills/pac-review-shared/SKILL.md`.

## Goal

Produce a structured standard review from the normalized packet and source change context.

## Instructions

Use the shared report contract exactly. Reason from the normalized packet and source change context. Keep unknown packet fields unknown and report any unverified delegation or packet-derivation guarantees honestly. Do not consume prior adversarial findings as input. Return only the final report.

## Correctness Heuristics

Check these specifically — do not just assert "looks correct":

- **Logic errors**: off-by-one conditions, wrong boolean operators, inverted conditionals, incorrect null or zero handling.
- **State mutation**: shared mutable state that may be modified by concurrent callers or across unexpected call sites.
- **Error handling**: unhandled error paths, swallowed exceptions, silent fallbacks that mask failures, missing propagation of errors to callers.
- **Data contract mismatches**: function signatures, API payloads, or schema fields that do not match what callers or consumers expect.
- **Edge cases**: empty inputs, zero values, missing optional fields, very large inputs, or boundary values the code does not explicitly handle.
- **Side effects**: operations that write, delete, or commit as a side effect of what appears to be a read-only or query path.

## Scope Alignment Heuristics

- Compare observed change to the stated intent in the commit message, OpenSpec proposal, or task description when available.
- Flag files or functions changed that are outside the described intent without a clear explanation.
- Flag requirements mentioned in the proposal or spec that have no corresponding change in the diff.
- Note when a change appears to fix a symptom without addressing a likely root cause.

## Maintainability Heuristics

- **Naming**: identifiers, functions, or variables with names that do not match what they actually do.
- **Coupling**: logic that reaches across module or layer boundaries in ways that make future changes risky.
- **Duplication**: non-trivial logic repeated in two or more places that will likely diverge over time.
- **Magic values**: unexplained numeric or string literals that should be named constants or configuration.
- **Complexity**: functions longer than a single screen that mix multiple concerns without clear structure.
- **Reversibility**: changes that are hard or impossible to roll back cleanly — note these even when the change itself looks correct.

## Verification Gap Heuristics

- Missing tests for the main success path of new or changed behavior.
- Missing tests for the error or edge-case paths identified in correctness heuristics above.
- Behavior that can only be verified at runtime or in production with no observable signal before shipping.
- Assertions or tests that pass trivially and do not actually constrain the behavior they appear to cover.
- Missing integration or contract tests when a change crosses a module or service boundary.
