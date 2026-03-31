---
description: Run standard and adversarial reviews in parallel and synthesize a verdict
subtask: true
---

# Run a mixed review

Run the mixed review workflow for `$ARGUMENTS` or the current change context.

## Workflow

1. Prepare one normalized review target packet shared by both lanes.
2. Load `skills/pac-review-shared/SKILL.md` for the shared packet, report, and mixed-verdict contracts.
3. Load `skills/pac-review-mixed/SKILL.md` for the mixed-review orchestration instructions.
4. Launch fresh delegated standard and adversarial review lanes in parallel from the same packet.
5. Return the two lane reports plus the explicit comparison and verdict.

## Constraints

- Analysis only
- Do not edit files, apply patches, stage changes, or create commits
- Mixed review is the explicit comparison path; do not infer comparison from prior thread state alone
