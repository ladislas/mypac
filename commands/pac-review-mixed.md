---
description: Run standard and adversarial reviews in parallel and synthesize a verdict
subtask: true
---

# Run a mixed review

Run the mixed review workflow for `$ARGUMENTS` or the current change context.

## Workflow

1. Prepare one normalized review target packet shared by both lanes.
2. Derive requested target, branch, base branch, diff source, and OpenSpec context from observable evidence in that order, keeping unknowns explicit.
3. Load `skills/pac-review-shared/SKILL.md` for the shared packet, report, and mixed-verdict contracts.
4. Invoke `pac-reviewer-standard` and `pac-reviewer-adversarial` in parallel via the Task tool, passing the same normalized packet to both.
5. Wait for both subagents to return their reports.
6. Load `skills/pac-review-mixed/SKILL.md` for the mixed-review synthesis instructions.
7. Produce the explicit comparison and verdict using both lane reports.
8. If either Task tool invocation cannot be confirmed as a fresh child session, report the degraded execution mode explicitly and lower verdict confidence accordingly.
9. Return the two lane reports plus the explicit comparison and verdict.

## Constraints

- Analysis only
- Do not edit files, apply patches, stage changes, or create commits
- Mixed review is the explicit comparison path; do not infer comparison from prior thread state alone
