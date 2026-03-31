---
name: pac-review-mixed
description: Mixed review orchestrator for parallel standard and adversarial lanes plus explicit synthesis.
license: MIT
---

# Mixed Review Workflow

Use this asset with `skills/pac-review-shared/SKILL.md`.

## Goal

Run standard and adversarial reviews in parallel from the same normalized packet, then synthesize an explicit comparison and verdict.

## Instructions

- Launch fresh delegated `standard` and `adversarial` review lanes in parallel.
- Give both lanes the same normalized review target packet.
- Do not pass either lane's findings into the other lane.
- After both lane reports return, produce the shared mixed comparison and verdict.
- Return analysis only.
