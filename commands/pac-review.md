---
description: Run the standard analysis-only review workflow
subtask: true
---

# Run a standard review

Run the standard review workflow for `$ARGUMENTS` or the current change context.

## Workflow

1. Prepare one normalized review target packet for this review.
2. Derive requested target, branch, base branch, diff source, and OpenSpec context from observable evidence in that order, keeping unknowns explicit.
3. Invoke the `pac-reviewer-standard` subagent via the Task tool, passing the full normalized packet as the task prompt.
4. If Task tool delegation cannot be confirmed, report that clearly instead of running the review inline.
5. Return only the final structured standard review report from the subagent.

## Constraints

- Analysis only
- Do not edit files, apply patches, stage changes, or create commits
- Do not compare with other review lanes unless the user asked for `/pac-review-mixed`
