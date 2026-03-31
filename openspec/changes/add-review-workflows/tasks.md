## 1. Command and prompt scaffolding

- [x] 1.1 Keep `/pac-review`, `/pac-review-adversarial`, and `/pac-review-mixed` as thin command definitions with clear purpose, inputs, and analysis-only guardrails
- [x] 1.2 Move detailed review rules, lane emphasis, and report expectations into shared delegated reviewer prompt assets or skills
- [x] 1.3 Define how the main thread gathers normalized review target context such as branch, base branch, relevant OpenSpec change, and optional user focus before delegation
- [x] 1.4 Review the existing OpenCode `/review` template, the gstack review workflow, and the comprehensive-review plugin to extract the patterns worth reusing without importing unnecessary complexity

## 2. Standard review workflow

- [x] 2.1 Implement `/pac-review` so it launches a fresh delegated subagent instead of running the full review inline in the main thread
- [x] 2.2 Implement the standard review report structure covering status, summary, scope, findings, verification gaps, and recommended next actions
- [x] 2.3 Ensure the standard review workflow returns analysis only and does not write code or apply fixes
- [x] 2.4 Add a pre-findings scope check that summarizes intended change scope and flags likely drift or missing requirement coverage when relevant context is available

## 3. Adversarial review workflow

- [x] 3.1 Implement `/pac-review-adversarial` so it launches a fresh delegated subagent with adversarial review instructions
- [x] 3.2 Ensure the adversarial workflow receives source change context but not prior standard-review findings as input
- [x] 3.3 Configure command-level adversarial routing or preferred model selection, with clear fallback messaging when the preferred route is unavailable
  <!-- v1 resolution: no alternate model route is configured; the command was previously set to the same default model (no differentiation). That model frontmatter has been removed. The command now explicitly reports preferred route status as `unavailable` and documents that adversarial independence relies on fresh delegated context alone. Routing differentiation is deferred to a future slice. -->

## 4. Mixed review workflow

- [x] 4.1 Implement `/pac-review-mixed` so it launches standard and adversarial delegated review lanes in parallel from the same normalized input
  <!-- v2 note: "launch" now means explicit Task tool invocation of named subagents, not inline execution -->
- [x] 4.2 Add explicit comparison output that highlights overlapping findings, unique findings, contradictory conclusions, and unresolved verification gaps
- [x] 4.3 Add a synthesized mixed-review verdict that is based on the explicit comparison rather than implicit session-state detection after separate runs

## 5. Documentation and workflow guidance

- [x] 5.1 Update repository docs to explain when to use each review command and what each one is meant to catch
- [x] 5.2 Document that fresh delegated context is the default review isolation mechanism and that a fresh session is recommended for maximum adversarial independence
- [x] 5.3 Verify the new review workflows align with existing runtime-awareness and model-routing guidance, including honest fallback behavior for adversarial routing preferences
- [x] 5.4 Document recommended usage patterns for standard review alone, adversarial review alone, and explicit mixed-review flow for higher-risk changes

## 6. Runtime-honesty refinements

- [x] 6.1 Define and implement explicit packet-derivation rules for requested target, branch, base branch, diff source, and active OpenSpec context
- [x] 6.2 Define and implement degraded-mode reporting when fresh delegation, parallel lane execution, or preferred routing cannot be verified
- [x] 6.3 Define and implement explicit semantics for adversarial route status (`honored`, `unavailable`, `unknown`) and require mixed review to report that status honestly

## 7. Named subagent isolation

- [ ] 7.1 Create `agents/pac-reviewer-standard.md` as a hidden subagent with read-only permissions and a system prompt backed by the standard review skill
- [ ] 7.2 Create `agents/pac-reviewer-adversarial.md` as a hidden subagent with read-only permissions, configured model, and a system prompt backed by the adversarial review skill
- [ ] 7.3 Update `/pac-review` to invoke `pac-reviewer-standard` by name via the Task tool instead of instructing inline delegation
- [ ] 7.4 Update `/pac-review-adversarial` to invoke `pac-reviewer-adversarial` by name via the Task tool instead of instructing inline delegation
- [ ] 7.5 Update `/pac-review-mixed` to invoke both named subagents in parallel via the Task tool and synthesize after both return
- [ ] 7.6 Update `pac-review-mixed` and `pac-review-shared` skills to reflect that isolation is now guaranteed by named subagent sessions, not just instructed
- [ ] 7.7 Update README and docs to document the named-subagent architecture and what isolation guarantee it actually provides
