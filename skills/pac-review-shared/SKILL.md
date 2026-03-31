---
name: pac-review-shared
description: Shared prompt asset for structured standard and adversarial review reports.
license: MIT
---

# Shared Review Contract

Use this asset for both `/pac-review` and `/pac-review-adversarial`.

## Purpose

- Keep both review workflows structurally compatible
- Normalize the review target before delegation so both passes inspect the same source-of-truth context
- Keep review analysis only

## Normalized Review Target Packet

Prepare one packet before delegated review work. Include only fields that are known.

```text
reviewMode: standard | adversarial
requestedTarget: raw user input if present
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
constraints:
  analysisOnly: true
  noCodeWrites: true
  noFixImplementation: true
  excludePriorReviewFindings: true for adversarial mode
```

## Structured Report Contract

Return a report with these sections in this order.

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

### Findings

- Primary section
- Focus on concrete bugs, regressions, hidden assumptions, maintainability risks, and meaningful missing tests
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
- Do not apply patches
- Do not stage or commit changes
- Do not rewrite the code in the report unless a tiny illustrative snippet is necessary
- If uncertain, reduce confidence and explain the missing evidence

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
