---
description: Run a skeptical analysis-only review of the current change context
---

# Run an adversarial review

Run an independent skeptical review of the current change context.

This workflow is analysis only. It must not edit files, implement fixes, stage changes, or create commits.

## Purpose

- Pressure-test the change for hidden assumptions, subtle failure modes, and false confidence
- Reuse the same normalized review target as the standard review so outputs stay comparable
- Preserve independence by reasoning from source change context rather than prior review conclusions

## Input

The argument after `/pac-review-adversarial` is optional and can include:

- A review target such as a branch name, commit, diff base, PR reference, or OpenSpec change name
- A short user focus such as `focus rollback risk`, `focus edge cases`, or `focus missing tests`

If omitted, review the current working change context.

Model-override syntax is intentionally deferred to the later implementation slice that wires runtime-supported delegated model selection.

## Main-Thread Preparation

Before any delegated review work, prepare the same normalized review target packet used by `/pac-review`.

Gather:

1. Review target
   - Current branch name
   - Base branch or diff source when it can be inferred
   - Explicit user-supplied target when provided

2. Intent context
   - Relevant OpenSpec change when one is clearly active or explicitly named
   - The most relevant proposal, design, spec, and task context for that change
   - Optional user focus or risk areas called out in the command input

3. Runtime context when relevant
   - Current agent, previous agent, and active model from runtime introspection when that context affects routing or comparison
   - Omit runtime details when they are not useful to the review target

4. Independence contract
   - Analysis only
   - No code writes or fix-up patches
   - Do not pass prior standard-review findings into the adversarial review input

## Shared Report Contract

Use the shared review asset at `skills/pac-review-shared/SKILL.md`.

The resulting report should follow the shared core structure:

- Status
- Summary
- Scope and intent check
- Findings
- Verification gaps
- Recommended next actions

Adversarial review may add failure-mode emphasis inside those sections without changing the contract.

## Guardrails

- Review only. Do not implement fixes.
- Preserve independence from prior review conclusions.
- Prefer realistic failure scenarios over speculative noise.
- Read full changed files after inspecting diffs; diffs alone are not enough.
- If intent context exists, summarize delivered scope before detailed findings.
- If context is too weak to support a confident conclusion, report the uncertainty explicitly.
- Keep this workflow smaller than a full specialist-review framework.
