---
name: pac-tdd
description: "Guide pragmatic test-driven implementation through small vertical slices. Use when implementing behavior-changing features or bug fixes, especially when tests, regression coverage, red-green-refactor, tracer bullets, or public-interface testing are relevant."
license: MIT
compatibility: Pi coding agent
metadata:
  author: mypac
  stage: shared
---

# Pragmatic TDD

Use this skill for behavior-changing implementation: new features, bug fixes, and changes where regression coverage matters. Do not add ceremony for trivial edits, docs-only changes, wording-only prompt or skill edits, mechanical renames, config-only changes, exploratory spikes, or work already fully covered by existing checks.

## Core rule

Work in small vertical slices:

```text
RED:   Add one focused test for one observable behavior and watch it fail.
GREEN: Add the smallest implementation that makes that test pass.
REFACTOR: Clean up only after tests are green, then run checks again.
```

Do not write all tests first and all implementation later. That horizontal slice usually tests imagined structure instead of learned behavior.

## Before coding

- State the public behavior you are about to change.
- Identify the public interface or command that should prove the behavior.
- Pick the first tracer-bullet test: the smallest end-to-end path that exercises the real seam.
- State any skipped-test rationale up front if TDD is not appropriate.

For larger or ambiguous work, confirm the plan with the user before implementation.

## Test shape

Wording-only instruction edits need no new tests by default. Static instruction-source checks must identify a machine-enforced invariant (such as loader metadata, reference validity, or argument interpolation) or an explicitly required template format, and be labeled as structural checks—not agent behavior. Claims that an agent follows instructions require agent execution/evaluation evidence; vocabulary matches cannot establish that behavior.

Default to behavior-level tests through public interfaces. A good test should still pass after an internal refactor when behavior is unchanged.

Use focused internal unit tests only when they are the simplest honest way to cover complex logic or a hard-to-reach legacy seam. If you do, name the reason.

Load deeper notes when relevant:

- [tests.md](tests.md) — choosing behavior-level tests and avoiding implementation-detail assertions
- [mocking.md](mocking.md) — mocking only at real system boundaries
- [refactoring.md](refactoring.md) — safe cleanup once tests are green
- [deep-modules.md](deep-modules.md) — shaping testable modules with small interfaces and deep implementations
- [interface-design.md](interface-design.md) — designing public seams that are easy to exercise

## Cycle checklist

For each slice:

- [ ] The test describes observable behavior, not implementation mechanics.
- [ ] The test uses a public interface unless a tactical internal seam is justified.
- [ ] The test fails for the expected reason before implementation when practical.
- [ ] The implementation is the smallest useful change for this behavior.
- [ ] All relevant tests pass before refactoring.
- [ ] Any refactor stays inside the proven behavior.

## Bug-fix handoff from `pac-diagnose`

Keep diagnosis separate. Use `pac-diagnose` to isolate the bug and find a reliable repro. Then use this skill to turn the repro into a failing regression test, implement the fix, and refactor only after the regression passes.

## Commit and report

Commit meaningful completed green/refactor slices, not every tiny red-green step.

When reporting back, include:

- tests added or updated,
- checks run,
- behaviors covered,
- skipped-test rationale when no tests were added,
- the next slice if work remains incomplete.
