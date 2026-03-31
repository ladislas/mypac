---
description: Run the adversarial analysis-only review workflow
subtask: true
model: github-copilot/claude-sonnet-4.6
---

# Run an adversarial review

Run the adversarial review workflow for `$ARGUMENTS` or the current change context.

## Workflow

1. Prepare one normalized review target packet for this review.
2. Load `skills/pac-review-shared/SKILL.md` for the shared packet and report contract.
3. Load `skills/pac-review-adversarial/SKILL.md` for the adversarial-lane instructions.
4. Launch the review in a fresh delegated context.
5. Prefer the command-level model route above when the runtime honors it.
6. If that preferred route is not honored, say so clearly in the output instead of implying stronger isolation than was actually achieved.
7. Return only the final structured adversarial review report.

## Constraints

- Analysis only
- Do not edit files, apply patches, stage changes, or create commits
- Do not consume prior standard-review findings as adversarial review input
- Do not advertise or rely on a per-invocation `--model` override
