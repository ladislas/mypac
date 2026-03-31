## Context

The repository already has primary command entrypoints, reusable skills, Rick persona agents, and runtime awareness for the active agent and model. What is missing is a first-class review workflow that turns that infrastructure into something useful before implementation or shipping.

This change introduces three related workflows: `/pac-review` for a standard review pass, `/pac-review-adversarial` for a skeptical independent pass, and `/pac-review-mixed` for an explicit side-by-side synthesis of both. The user-facing commands should stay thin, while detailed reviewer behavior lives in delegated prompt assets. All workflows should avoid bloating the main conversation context, and the adversarial pass should avoid inheriting the first review's conclusions.

Relevant external references already exist and are worth learning from without copying wholesale: OpenCode's built-in `/review` template for lightweight diff-plus-context review, the gstack review workflow for scope and intent auditing, and the comprehensive-review plugin for orchestration patterns that combine command entrypoints with delegated reviewer roles.

## Goals / Non-Goals

**Goals:**

- Add standard, adversarial, and mixed review commands with consistent naming and documentation.
- Run both reviews through fresh delegated subagent execution so the main thread stays focused and the review context stays isolated.
- Keep main-thread command text small by pushing detailed review rules and report expectations into reusable delegated reviewer assets.
- Define a shared structured report format so review outputs are actionable and comparable.
- Preserve stronger independence for adversarial review by preventing it from receiving standard review findings as input.
- Prefer honest command-level model configuration or routing over per-invocation override flags that may not be enforceable.
- Define observable rules for packet derivation, degraded execution modes, and route-honoring status so the workflow can report uncertainty instead of bluffing.

**Non-Goals:**

- Implement automatic code fixing as part of review.
- Require a different model provider for v1 in every environment.
- Build a full persistent review analytics system in the first slice.
- Replace human judgment or manual follow-up after a review report.

## Decisions

### Review lanes are named subagents, not inline prompts

The standard and adversarial review lanes will be implemented as named OpenCode subagents (`pac-reviewer-standard` and `pac-reviewer-adversarial`) defined in `agents/`. Each subagent has `mode: subagent`, `hidden: true`, a configured model, read-only permissions, and a system prompt that loads the relevant skill. Review commands invoke them by name via the Task tool, which creates a genuine child session — not an inline continuation of the main thread context.

Alternative considered: instruct the primary agent inline to "delegate" by reasoning through both reviews itself. Rejected because without a named Task tool invocation there is no actual session boundary; the LLM reads the instruction and decides to execute inline, which is exactly what was observed in practice. Named agents are the only reliable mechanism for isolation that OpenCode actually provides.

Alternative considered: `subtask: true` command-level flag. Rejected because `subtask` controls how the command result appears in the parent UI, not whether isolation happens. The primary agent still runs the command inline.

### Commands remain the user-facing API

The primary UX will be `/pac-review`, `/pac-review-adversarial`, and `/pac-review-mixed`. Each command should stay small and action-oriented rather than becoming a long-lived agent mode or a giant prompt blob.

Alternative considered: dedicated primary review agents. Rejected because the main need is a repeatable workflow with clean invocation semantics, not a new conversational role.

### Detailed review instructions live in delegated assets

The main-thread commands should describe the workflow briefly and then delegate to reusable reviewer prompts or skills that carry the detailed review rules, report contract, and emphasis for each lane. This keeps the user-facing command definitions readable and reduces duplication.

Alternative considered: embed the full reviewer instructions directly in each command file. Rejected because it bloats command text and makes the standard, adversarial, and mixed flows harder to keep aligned.

### Reviews run in fresh delegated subagent context

The standard and adversarial review lanes will launch in fresh delegated subagent context and return only their final reports. This reduces context pollution in the main thread and gives the adversarial pass practical isolation from previous reasoning.

Alternative considered: run reviews inline in the main thread. Rejected because it bloats context and weakens independence.

### Adversarial review is independent by input contract

`/pac-review-adversarial` will receive the same source-of-truth context as the standard review, but it will not receive the standard review findings. Comparison happens only inside the explicit mixed workflow after both reports exist.

Alternative considered: ask the adversarial review to critique the first review directly. Rejected because it anchors the second pass and weakens the value of independent verification.

### Shared report schema enables comparison

Both review workflows will return the same core sections: status, summary, scope, findings, verification gaps, and recommended next actions. The adversarial workflow adds a failure-modes emphasis but stays structurally compatible.

Alternative considered: free-form prose review output. Rejected because it makes comparison and later automation brittle.

### Mixed review performs explicit orchestration and synthesis

`/pac-review-mixed` should launch standard and adversarial delegated reviews in parallel from the same normalized input packet, then produce an explicit comparison that calls out overlap, unique findings, contradictions, and an overall verdict. This comparison should be a defined workflow output, not a hidden side effect of session state.

Alternative considered: infer comparison whenever both review reports happen to exist in thread state. Rejected because implicit session-state behavior is harder to reason about and less reliable than an explicit mixed command.

### Review input is normalized before delegation

Before launching delegated review work, the main thread will normalize the review target into a shared input packet that includes the change target, base branch or diff source, relevant OpenSpec change context when available, and optional user focus. This keeps both review lanes grounded in the same source-of-truth context.

Alternative considered: let each review workflow discover context independently from scratch. Rejected because it increases drift between the two passes and makes comparison noisier.

### Packet derivation follows explicit evidence-first rules

The normalized packet should not be a vibes-based summary. It should derive fields from observable sources in a stable order: explicit user target first, then current git branch and merge base when available, then active OpenSpec change context when it is clearly inferable, and finally explicit ambiguity notes when the evidence is missing or conflicting. Unknown values should remain unknown rather than being guessed.

Alternative considered: let the reviewer fill in plausible packet values from surrounding context. Rejected because comparison only works when both lanes start from the same proven input.

### Scope and intent are checked before detailed findings

The review workflow should summarize the intended scope before listing detailed findings when enough context exists. That scope check can use user-provided focus, branch or diff context, and relevant OpenSpec artifacts to identify likely drift or missing requirement coverage.

Alternative considered: jump straight to bug findings. Rejected because reviews are more useful when they first establish whether the change appears to match its intended goal.

### Specialist review lanes remain an extension point

The initial implementation will keep one standard review lane and one adversarial lane, but the design should leave room for optional focused subreviews later, such as security, performance, design, or test-depth passes.

Alternative considered: build a full multi-specialist review orchestrator in the first slice. Rejected because it adds too much machinery before the core review commands prove their value.

### Model routing is configured, not promised per invocation

The adversarial workflow should prefer configured routing or command-level model selection instead of advertising a per-invocation `--model` override that the runtime may not reliably honor. If a preferred alternate route is unavailable, the system should say so clearly rather than pretending a stronger independence guarantee than it actually achieved.

Alternative considered: support dynamic per-run model overrides in the command contract. Rejected because unenforceable override claims would mislead users about the actual review isolation they received.

### Routing status uses explicit semantics

The workflow should only mark preferred routing as honored when the runtime provides positive evidence that the configured route was used. It should mark the route as unavailable when the runtime explicitly rejects or bypasses the preferred route, and mark it as unknown when the runtime offers no proof either way. Mixed review should report that status lane-by-lane instead of flattening it into a single optimistic assumption.

Alternative considered: treat silence from the runtime as success unless a failure is obvious. Rejected because silent fallback is exactly the false-confidence trap this workflow is meant to avoid.

### Degraded execution modes must be surfaced explicitly

If the runtime cannot verify fresh delegation, parallel lane execution, or preferred routing, the workflow should not quietly continue as if the happy path happened. Instead it should surface the missing guarantee, lower confidence, and bias the mixed-review verdict toward caution or insufficient context depending on how much evidence is missing.

Alternative considered: keep degraded behavior implicit and rely on reviewer judgment alone. Rejected because users need a predictable contract for when the runtime weakens the claimed review guarantees.

### Fresh session is recommended for maximum independence

Fresh delegated context is the default, but docs should also recommend running `/pac-review-adversarial` in a new session when users want the strongest practical independence from earlier review findings.

## Risks / Trade-offs

- **Fresh subagent still shares the session model by default** → Prefer configured alternate routing where available and document fresh-session guidance plus honest fallback behavior.
- **Runtime may not prove whether delegation, parallelism, or routing happened as intended** → Define degraded-mode reporting and route-status semantics so the workflow can stay truthful under uncertainty.
- **Two reviews may duplicate findings** → Use a consistent report format so overlap is easy to identify and compare.
- **Mixed review adds orchestration complexity** → Keep the command thin, run only two delegated lanes in parallel, and synthesize with an explicit comparison contract.
- **Review prompts may become too broad and noisy** → Keep the standard pass focused on correctness, scope, maintainability, and verification gaps, and keep the adversarial pass focused on hidden assumptions and failure modes.
- **Borrowing too much from external review frameworks could bloat v1** → Use external references for proven ideas such as full-file context, scope auditing, and structured comparison, but keep implementation limited to the three-command workflow in this change.
- **Users may expect review to auto-fix issues** → Document review as analysis only and reserve implementation for `/pac-apply`.

## Migration Plan

1. Add the new review capability spec and approve the behavior contract.
2. Implement thin command entrypoints and supporting delegated reviewer assets.
3. Wire standard and adversarial review execution through fresh delegated subagent calls.
4. Implement `/pac-review-mixed` to launch both lanes in parallel and synthesize an explicit comparison.
5. Configure and document adversarial model routing preferences and honest fallback behavior.
6. Define packet-derivation rules and degraded-mode reporting for unverifiable runtime guarantees.
7. Update repository docs so review usage and independence guidance are discoverable.

## Open Questions

- Where should command-level adversarial model preference live if multiple runtimes expose different routing mechanisms?
  **Resolved (v1):** Deferred. No preferred route is configured in v1. The adversarial command relies on fresh delegated context alone for independence. Routing differentiation is an extension point for a future slice when a reliable alternate route is available.

- How opinionated should the mixed-review verdict be when the two lanes disagree strongly but neither found a clearly blocking issue?
  **Resolved (v1):** Use `caution` when lanes disagree on severity or risk but neither asserts a blocking finding with evidence. Use `blocking` only when at least one lane explicitly flags a finding that should be resolved or disproven before shipping. Do not escalate to `blocking` on disagreement alone without a specific evidenced finding.
