## 1. Command and prompt scaffolding

- [x] 1.1 Add `/pac-review` and `/pac-review-adversarial` command definitions with clear purpose, inputs, and analysis-only guardrails
- [x] 1.2 Add shared review prompt assets or skills that define the structured report contract for both workflows
- [x] 1.3 Define how the main thread gathers review target context such as branch, base branch, relevant OpenSpec change, and optional user focus before delegation
- [x] 1.4 Review the existing OpenCode `/review` template, the gstack review workflow, and the comprehensive-review plugin to extract the patterns worth reusing without importing unnecessary complexity

## 2. Standard review workflow

- [x] 2.1 Implement `/pac-review` so it launches a fresh delegated subagent instead of running the full review inline in the main thread
- [x] 2.2 Implement the standard review report structure covering status, summary, scope, findings, verification gaps, and recommended next actions
- [x] 2.3 Ensure the standard review workflow returns analysis only and does not write code or apply fixes
- [x] 2.4 Add a pre-findings scope check that summarizes intended change scope and flags likely drift or missing requirement coverage when relevant context is available

## 3. Adversarial review workflow

- [x] 3.1 Implement `/pac-review-adversarial` so it launches a fresh delegated subagent with adversarial review instructions
- [x] 3.2 Ensure the adversarial workflow receives source change context but not prior standard-review findings as input
- [x] 3.3 Add support for explicit adversarial model selection when the runtime supports delegated model override, with clear fallback messaging when it does not
- [x] 3.4 Add main-thread comparison output that highlights overlapping findings, unique findings, contradictory conclusions, and unresolved verification gaps when both standard and adversarial review reports exist

## 4. Documentation and workflow guidance

- [ ] 4.1 Update repository docs to explain when to use each review command and what each one is meant to catch
- [ ] 4.2 Document that fresh delegated context is the default review isolation mechanism and that a fresh session is recommended for maximum adversarial independence
- [ ] 4.3 Verify the new review workflows align with existing runtime-awareness and model-routing guidance
- [ ] 4.4 Document recommended usage patterns for standard review alone, adversarial review alone, and paired-review flow for higher-risk changes
