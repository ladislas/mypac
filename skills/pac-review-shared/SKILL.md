---
name: pac-review-shared
description: Shared contracts and guardrails for standard, adversarial, and mixed review workflows.
license: MIT
---

# Shared Review Contract

Use this asset with the review lane assets under `skills/`.

The main agent is the orchestrator. Delegated reviewers perform the review work and return reports only.

## Normalized Review Target Packet

Prepare one packet before delegated review work. Include only known fields.

```text
reviewMode: standard | adversarial | mixed
requestedTarget: raw user input when present
branch: current branch under review when known
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
routing:
  preferredCommandModel: command-level model when configured
  preferredRouteHonored: true | false | unknown
  routingNotes: clear explanation when the preferred route was not honored
constraints:
  analysisOnly: true
  noCodeWrites: true
  noFixImplementation: true
  excludePriorReviewFindings: true
```

## Standard And Adversarial Report Contract

Both lanes return the same core structure in this order.

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

### Lane Rules

- `standard` focuses on correctness, scope alignment, maintainability, and verification gaps.
- `adversarial` focuses on hidden assumptions, subtle failure modes, rollback risk, and false confidence.
- Both lanes should read full changed files after inspecting diffs.
- Both lanes should summarize scope before detailed findings when intent context exists.
- If there are no actionable findings, write `- No actionable findings.` under `## Findings`.

## Mixed Review Comparison And Verdict Contract

`mixed` is the explicit comparison workflow. Do not compare implicitly just because both lane reports happen to exist in the thread.

When mixed review completes, return the standard report, the adversarial report, and this synthesis section:

```markdown
## Mixed Review Comparison
### Overlapping Findings
- <same issue or materially similar concern raised by both reviews, or `None noted.`>

### Unique To Standard Review
- <finding only the standard review surfaced, or `None noted.`>

### Unique To Adversarial Review
- <finding only the adversarial review surfaced, or `None noted.`>

### Contradictions Or Tension
- <places where the reviews disagree on severity, scope alignment, or acceptable risk, or `None noted.`>

### Unresolved Verification Gaps
- <evidence still missing after considering both reports, or `None noted.`>

## Mixed Review Verdict
Verdict: <clear | caution | blocking | insufficient-context>
Basis: <2-4 sentences explaining the synthesized judgment from both lanes>
```

### Mixed Verdict Meanings

- `clear`: no material issues across the combined evidence
- `caution`: non-blocking but meaningful risk or follow-up remains
- `blocking`: one or more findings should be resolved or disproven before shipping
- `insufficient-context`: missing evidence is too large for a confident combined judgment

## Routing Honesty Rules

- Prefer command-level routing when a review command configures one.
- Do not advertise a dynamic per-invocation `--model` override unless the runtime actually supports and honors it.
- If a preferred route was not honored, say so clearly in the workflow output.
- Do not imply model isolation stronger than the runtime actually provided.

## Analysis-Only Guardrails

- Do not edit files.
- Do not write code or apply patches.
- Do not use tools or commands that modify files, stage changes, or create commits.
- Do not stage or commit changes.
- Do not implement fixes as part of the review.
- Return analysis only. Recommended actions may suggest fixes, but the review must not perform them.
- If uncertain, lower confidence and explain the missing evidence.
