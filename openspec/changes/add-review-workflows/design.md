## Context

The repository already has primary command entrypoints, reusable skills, Rick persona agents, and runtime awareness for the active agent and model. What is missing is a first-class review workflow that turns that infrastructure into something useful before implementation or shipping.

This change introduces two related workflows: `/pac-review` for a standard review pass and `/pac-review-adversarial` for a skeptical independent pass. Both should avoid bloating the main conversation context, and the adversarial pass should avoid inheriting the first review's conclusions.

Relevant external references already exist and are worth learning from without copying wholesale: OpenCode's built-in `/review` template for lightweight diff-plus-context review, the gstack review workflow for scope and intent auditing, and the comprehensive-review plugin for orchestration patterns that combine command entrypoints with delegated reviewer roles.

## Goals / Non-Goals

**Goals:**

- Add a standard review command and an adversarial review command with consistent naming and documentation.
- Run both reviews through fresh delegated subagent execution so the main thread stays focused and the review context stays isolated.
- Define a shared structured report format so review outputs are actionable and comparable.
- Preserve stronger independence for adversarial review by preventing it from receiving standard review findings as input.
- Allow adversarial review to use either the session-default routing or an explicit model override when supported.

**Non-Goals:**

- Implement automatic code fixing as part of review.
- Require a different model provider for v1 in every environment.
- Build a full persistent review analytics system in the first slice.
- Replace human judgment or manual follow-up after a review report.

## Decisions

### Commands remain the user-facing API

The primary UX will be `/pac-review` and `/pac-review-adversarial`. This keeps review as an action-oriented workflow rather than a new long-lived agent mode.

Alternative considered: dedicated primary review agents. Rejected because the main need is a repeatable workflow with clean invocation semantics, not a new conversational role.

### Reviews run in fresh delegated subagent context

Both review commands will launch a fresh subagent to inspect the repo state and return only the final report. This reduces context pollution in the main thread and gives the adversarial pass practical isolation from previous reasoning.

Alternative considered: run reviews inline in the main thread. Rejected because it bloats context and weakens independence.

### Adversarial review is independent by input contract

`/pac-review-adversarial` will receive the same source-of-truth context as the standard review, but it will not receive the standard review findings. Comparison happens later in the main thread after both reports exist.

Alternative considered: ask the adversarial review to critique the first review directly. Rejected because it anchors the second pass and weakens the value of independent verification.

### Shared report schema enables comparison

Both review workflows will return the same core sections: status, summary, scope, findings, verification gaps, and recommended next actions. The adversarial workflow adds a failure-modes emphasis but stays structurally compatible.

Alternative considered: free-form prose review output. Rejected because it makes comparison and later automation brittle.

### Review input is normalized before delegation

Before launching either subagent, the main thread will normalize the review target into a shared input packet that includes the change target, base branch or diff source, relevant OpenSpec change context when available, and optional user focus. This keeps both workflows grounded in the same source-of-truth context.

Alternative considered: let each review workflow discover context independently from scratch. Rejected because it increases drift between the two passes and makes comparison noisier.

### Scope and intent are checked before detailed findings

The review workflow should summarize the intended scope before listing detailed findings when enough context exists. That scope check can use user-provided focus, branch or diff context, and relevant OpenSpec artifacts to identify likely drift or missing requirement coverage.

Alternative considered: jump straight to bug findings. Rejected because reviews are more useful when they first establish whether the change appears to match its intended goal.

### Specialist review lanes remain an extension point

The initial implementation will keep one standard review lane and one adversarial lane, but the design should leave room for optional focused subreviews later, such as security, performance, design, or test-depth passes.

Alternative considered: build a full multi-specialist review orchestrator in the first slice. Rejected because it adds too much machinery before the core review commands prove their value.

### Model selection is optional and explicit

The adversarial workflow should default to the configured routing behavior but may accept an explicit model override argument when the runtime supports it. This keeps the default simple while allowing cross-model verification for stronger independence.

Alternative considered: always hardcode a specific adversarial model. Rejected because model names change and the repo already prefers routing tiers over brittle vendor-specific defaults.

### Fresh session is recommended for maximum independence

Fresh delegated context is the default, but docs should also recommend running `/pac-review-adversarial` in a new session when users want the strongest practical independence from earlier review findings.

## Risks / Trade-offs

- **Fresh subagent still shares the session model by default** → Support explicit model override for adversarial review when available and document fresh-session guidance.
- **Two reviews may duplicate findings** → Use a consistent report format so overlap is easy to identify and compare.
- **Review prompts may become too broad and noisy** → Keep the standard pass focused on correctness, scope, maintainability, and verification gaps, and keep the adversarial pass focused on hidden assumptions and failure modes.
- **Borrowing too much from external review frameworks could bloat v1** → Use external references for proven ideas such as full-file context, scope auditing, and structured comparison, but keep implementation limited to the two-command workflow in this change.
- **Users may expect review to auto-fix issues** → Document review as analysis only and reserve implementation for `/pac-apply`.

## Migration Plan

1. Add the new review capability spec and approve the behavior contract.
2. Implement command entrypoints and any supporting skill or prompt assets.
3. Wire review execution through fresh delegated subagent calls.
4. Add adversarial review argument handling for model override if supported by the runtime.
5. Update repository docs so review usage and independence guidance are discoverable.

## Open Questions

- What is the exact argument syntax for model override, for example `--model <provider/model>` versus a tier-based flag?
- Should review comparison output be emitted automatically whenever both reports exist in the same session, or only when explicitly requested?
