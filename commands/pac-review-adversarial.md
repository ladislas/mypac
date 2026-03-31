---
description: Run the adversarial analysis-only review workflow
subtask: true
---

# Run an adversarial review

Run the adversarial review workflow for `$ARGUMENTS` or the current change context.

## Workflow

1. Prepare one normalized review target packet for this review.
2. Derive requested target, branch, base branch, diff source, and OpenSpec context from observable evidence in that order, keeping unknowns explicit.
3. Invoke the `pac-reviewer-adversarial` subagent via the Task tool, passing the full normalized packet as the task prompt.
4. No command-level preferred route is configured in v1. Report preferred route status as `unavailable` and note that adversarial independence relies on the isolated child session alone.
5. If Task tool delegation cannot be confirmed, report that clearly instead of running the review inline.
6. Return only the final structured adversarial review report from the subagent.

## Constraints

- Analysis only
- Do not edit files, apply patches, stage changes, or create commits
- Do not consume prior standard-review findings as adversarial review input
- Do not advertise or rely on a per-invocation `--model` override
