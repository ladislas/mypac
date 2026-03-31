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
- An explicit adversarial model request using `--model <provider/model-or-tier>` when delegated override is supported by the runtime

If omitted, review the current working change context.

## Main-Thread Preparation

Before any delegated review work, prepare the same normalized review target packet used by `/pac-review`.

The main agent stays the orchestrator. It prepares the normalized review target packet, launches the adversarial review in a fresh delegated subagent, and returns only the delegated report plus any later main-thread comparison output.

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

4. Requested delegated model override when present
   - Parse `--model <provider/model-or-tier>` from the command input
   - Include the requested override in the normalized packet only when the user provided it
   - If the runtime supports delegated model override, apply it to the fresh adversarial subagent
   - If the runtime cannot honor it, say so clearly in the main thread and fall back to the current routing defaults unless the user asked to stop instead of continuing

5. Independence contract
   - Analysis only
   - No code writes or fix-up patches
   - Do not pass prior standard-review findings into the adversarial review input

## Delegated Execution

After preparing the normalized review target packet:

1. Launch a fresh delegated subagent using the **Task tool** with `subagent_type: "general"`.
2. Pass the normalized packet plus the shared review asset path `skills/pac-review-shared/SKILL.md`.
3. Keep the main thread out of the detailed adversarial reasoning. Do not run the review inline in the main agent context.
4. Require the delegated reviewer to return only the final structured report for the adversarial review.

## Main-Thread Comparison Output

If a standard review report and an adversarial review report both exist in the current thread, append a comparison section after the delegated report.

That comparison should highlight:

- Overlapping findings reported by both reviews
- Findings unique to the adversarial review
- Findings unique to the standard review
- Contradictory conclusions or materially different risk judgments
- Unresolved verification gaps that still need evidence after considering both reports

Do not feed the standard review findings back into the delegated adversarial review input just to produce this comparison. The comparison is a main-thread synthesis step after both reports already exist.

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
