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

- Invoke `pac-reviewer-standard` and `pac-reviewer-adversarial` as named subagents in parallel via the Task tool from the same normalized packet.
- Give both subagents the same normalized review target packet.
- Do not pass either subagent's findings into the other subagent.
- After both child sessions return their reports, produce the shared mixed comparison and verdict.
- If either Task tool invocation cannot be confirmed as a fresh child session, or if parallel execution could not be achieved, report that explicitly and downgrade the final verdict: use `caution` when one guarantee is missing and `insufficient-context` when both fresh delegation and parallel execution are unverified.
- Return analysis only.
