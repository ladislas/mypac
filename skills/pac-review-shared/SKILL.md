---
name: pac-review-shared
description: Shared prompt asset for structured standard and adversarial review reports.
license: MIT
---

# Shared Review Contract

Use this asset for both `/pac-review` and `/pac-review-adversarial`.

The main agent is the orchestrator. The delegated reviewer does the review work and returns the final report only.

## Purpose

- Keep both review workflows structurally compatible
- Normalize the review target before delegation so both passes inspect the same source-of-truth context
- Keep review analysis only

## Normalized Review Target Packet

Prepare one packet before delegated review work. Include only fields that are known.

```text
reviewMode: standard | adversarial
requestedTarget: raw user input if present
requestedModelOverride: explicit --model value when provided
branch: current branch under review
baseBranch: inferred or explicit diff base when known
diffSource: working tree | commit | branch comparison | PR
openSpecChange:
  name: relevant change name when known
  artifacts: proposal/design/spec/tasks paths when relevant
userFocus: explicit user-supplied concerns or hot spots
runtimeContext:
  currentAgent: include when relevant
  previousAgent: include when relevant
  activeModel: include when relevant
delegatedModelOverrideApplied: true when a requested override was honored
constraints:
  analysisOnly: true
  noCodeWrites: true
  noFixImplementation: true
  excludePriorReviewFindings: true for adversarial mode
```

## Structured Report Contract

Return a report with these sections in this order.

Use this template:

```markdown
## Status
<clear | issues-found | insufficient-context>

## Summary
<2-4 sentence summary of what was reviewed and the overall risk shape>

## Scope And Intent Check
Result: <aligned | drifted | incomplete | unclear>
Intended scope: <brief summary or "Unclear from available context.">
Delivered scope: <brief summary of the observed change>
Coverage notes: <missing requirement coverage, likely drift, or "No obvious scope drift detected.">

## Findings
- Severity: <high | medium | low>
  Location: <file:line | n/a>
  Issue: <concise statement>
  Why it matters: <realistic consequence>
  Evidence: <specific code path, diff behavior, or missing coverage>

## Verification Gaps
- <missing tests, runtime evidence, ambiguous intent, unavailable environment context, or "None noted.">

## Recommended Next Actions
- <short analysis-only follow-up>
```

### Status

- `clear` when no material issues were found
- `issues-found` when one or more actionable findings exist
- `insufficient-context` when the review target or intent context is too weak for confident conclusions

### Summary

- Two to four sentences
- State what was reviewed and the overall risk shape

### Scope And Intent Check

- Summarize the intended change when enough context exists
- Label the result as `aligned`, `drifted`, `incomplete`, or `unclear`
- Call out likely missing requirement coverage before detailed findings
- Do this before writing any detailed findings
- If OpenSpec artifacts, user focus, or other intent context exist, compare them against the delivered change instead of restating the diff
- If the available context suggests likely drift or missing requirement coverage, flag it here even if there is not yet a code-level defect

### Findings

- Primary section
- Focus on concrete bugs, regressions, hidden assumptions, maintainability risks, and meaningful missing tests
- If there are no actionable findings, say `- No actionable findings.`
- For each finding include:
  - severity: `high`, `medium`, or `low`
  - location: file and line, or `n/a` when not line-specific
  - issue: concise statement of the problem
  - why_it_matters: realistic failure scenario or consequence
  - evidence: the specific code path, diff behavior, or missing coverage that supports the claim

### Verification Gaps

- List what could not be verified confidently
- Mention missing tests, missing runtime evidence, ambiguous intent, or unavailable environment context

### Recommended Next Actions

- Short actionable follow-up steps
- Analysis only; recommend fixes but do not perform them

## Analysis-Only Guardrails

- Do not edit files
- Do not write code or propose applied patches as if they were already made
- Do not apply patches
- Do not use tools or commands that modify files, stage changes, or create commits
- Do not stage or commit changes
- Do not rewrite the code in the report unless a tiny illustrative snippet is necessary
- Return analysis only; recommended actions may suggest fixes, but the review itself must not perform them
- If uncertain, reduce confidence and explain the missing evidence

## Review Isolation Rules

- The delegated reviewer must reason from the normalized review target packet and the source change context only.
- In adversarial mode, do not consume prior standard-review findings as review input, even if they exist elsewhere in the thread.
- If a requested `--model` override could not be applied by the runtime, the main thread should report that limitation clearly instead of implying the override succeeded.
- Comparison between standard and adversarial reports happens later in the main thread after both delegated reports exist.

## Main-Thread Comparison Template

When both a standard report and an adversarial report exist in the same thread, the main agent should append this comparison section after the delegated report that completed second:

```markdown
## Comparison Across Review Modes
### Overlapping Findings
- <same issue or materially similar concern raised by both reviews, or `None noted.`>

### Unique To Standard Review
- <finding only the standard review surfaced, or `None noted.`>

### Unique To Adversarial Review
- <finding only the adversarial review surfaced, or `None noted.`>

### Contradictions Or Tension
- <places where the reviews disagree on severity, scope alignment, or whether risk is acceptable, or `None noted.`>

### Unresolved Verification Gaps
- <evidence still missing after considering both reports, or `None noted.`>
```

## Distilled External Patterns

Keep the useful ideas. Skip the extra machinery.

### From OpenCode `/review`

- Accept flexible targets: current changes, commit, branch, or PR
- Treat diffs as a starting point only; read full changed files before judging behavior
- Focus findings on bugs and realistic regressions rather than style nitpicks

### From gstack-style review workflows

- Audit intended scope before enumerating bugs
- Use plan or spec context to catch drift, omission, and requirement mismatch
- Let user focus steer the pass toward the riskiest area without changing the shared report structure

### From comprehensive-review plugin patterns

- Separate command entrypoints from shared review instructions
- Keep one reusable report contract across review modes
- Preserve future extension points for specialist lanes without building the full orchestrator now
