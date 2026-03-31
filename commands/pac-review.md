---
description: Run a structured analysis-only review of the current change context
---

# Run a standard review

Run a structured review of the current change context.

This workflow is analysis only. It must not edit files, implement fixes, stage changes, or create commits.

## Purpose

- Review the current change for correctness, scope alignment, maintainability, and verification gaps
- Produce a reusable structured report instead of free-form notes
- Keep the main thread focused by normalizing review context before later delegated execution work

## Input

The argument after `/pac-review` is optional and can include:

- A review target such as a branch name, commit, diff base, PR reference, or OpenSpec change name
- A short user focus such as `focus tests`, `focus scope drift`, or `focus risky migrations`

If omitted, review the current working change context.

## Main-Thread Preparation

The main agent stays the orchestrator. It prepares one normalized review target packet, launches the review in a fresh delegated subagent, and returns only the delegated report.

Before any delegated review work, prepare one normalized review target packet shared by both review workflows.

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
   - Current agent, previous agent, and active model from runtime introspection when that context affects routing or interpretation
   - Omit runtime details when they are not useful to the review target

4. Review constraints
    - Analysis only
    - No code writes or fix-up patches
    - No prior adversarial-review findings as input

## Delegated Execution

After preparing the normalized review target packet:

1. Launch a fresh delegated subagent using the **Task tool** with `subagent_type: "general"`.
2. Pass the normalized packet plus the shared review asset path `skills/pac-review-shared/SKILL.md`.
3. Keep the main thread out of the detailed review reasoning. Do not run the main review inline in the main agent context.
4. Require the delegated reviewer to return only the final structured report for the standard review.

## Shared Report Contract

Use the shared review asset at `skills/pac-review-shared/SKILL.md`.

The resulting report should follow this core structure:

- Status
- Summary
- Scope and intent check
- Findings
- Verification gaps
- Recommended next actions

## Guardrails

- Review only. Do not implement fixes.
- Do not write code, apply patches, or otherwise modify the workspace as part of the review.
- Prefer real bugs, regressions, scope drift, and missing verification over style commentary.
- Read full changed files after inspecting diffs; diffs alone are not enough.
- If intent context exists, summarize delivered scope before detailed findings.
- If intent context is missing or ambiguous, say so clearly instead of guessing.
- Keep the workflow small and reusable; do not invent multi-lane review orchestration in this slice.
