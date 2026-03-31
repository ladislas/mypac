---
description: Run the standard analysis-only review workflow
subtask: true
---

# Run a standard review

Run the standard review workflow for `$ARGUMENTS` or the current change context.

## Workflow

1. Prepare one normalized review target packet for this review.
2. Load `skills/pac-review-shared/SKILL.md` for the shared packet and report contract.
3. Load `skills/pac-review-standard/SKILL.md` for the standard-lane instructions.
4. Launch the review in a fresh delegated context.
5. Return only the final structured standard review report.

## Constraints

- Analysis only
- Do not edit files, apply patches, stage changes, or create commits
- Do not compare with other review lanes unless the user asked for `/pac-review-mixed`
