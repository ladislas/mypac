# Model Routing

## Goal

Get consistent results without wasting budget, quota, or attention.

## Use tiers, not fixed model names

- `default`: the model you trust for most real edits
- `cheap`: search, summarize, classify, and draft options
- `fallback`: hard debugging, architecture, or recovery when the default model stalls

Keep the tiering stable even when model names change.

## Routing rules

1. Start with the `default` tier for real edits.
2. Use the `cheap` tier for exploration and triage only.
3. Escalate to the `fallback` tier only when:
   - blocked after one focused iteration, or
   - a bug survives one fix attempt, or
   - the task needs a broader architectural view than the current model can hold.

## Selection criteria

Choose the current model for each tier based on:

- reliability on your real tasks
- tool-use quality in your harness
- speed good enough for the loop you want
- quota or cost you can sustain every week
- portability across providers when possible

## Cost and quota control

- Prefer targeted reads over broad scans.
- Cap exploration depth per step.
- Require a short summary before escalation.
- Keep subagents on cheaper tiers by default.
- Change context before changing models.

## Review workflows

- Standard review should use the current routing defaults unless a later workflow explicitly says otherwise.
- Adversarial review gains independence from an isolated child session via the named `pac-reviewer-adversarial` subagent, not from automatic model churn.
- Adversarial review carries a configured command-level model (`github-copilot/claude-sonnet-4.6`) for future routing differentiation. In v1 this resolves to the same model as the default session. Route status is `unavailable` until a distinct alternate route is configured.
- Review workflows should treat preferred route status as `honored` only with positive runtime evidence, as `unavailable` when the runtime explicitly rejects or bypasses the preferred route, and as `unknown` when the runtime provides no proof either way.
- If that preferred route is `unavailable` or `unknown`, the workflow must say so clearly instead of implying stronger isolation than it actually achieved.
- Do not advertise a dynamic per-invocation `--model` review override unless the runtime actually supports and honors it.
- For the strongest practical independence, run the adversarial pass in a fresh outer session. The named subagent provides child-session isolation from the main thread; a fresh outer session removes any shared ambient context from prior conversation history.
- Use `/pac-review-mixed` when you want explicit parallel comparison between standard and adversarial lanes; it invokes both named subagents in parallel and synthesizes after both return.
- If a Task tool invocation cannot be confirmed as a fresh child session, the review should report that degraded mode explicitly and lower confidence rather than pretending the happy path was proven.

## Failure modes

- If usage spikes, reduce exploration depth first.
- If quality drops, add better context before escalating model strength.
- If a tier becomes unstable after a provider release, re-evaluate the tier assignment rather than forcing the workflow.

## Maintenance rule

Do not treat this file as a source of truth for live model IDs or pricing.
Use it to record routing principles only.
Verify current models, limits, and pricing from live provider sources before changing configs.

## Live references

- OpenCode docs: `https://opencode.ai/docs/`
- Anthropic pricing: `https://www.anthropic.com/pricing`
- OpenAI pricing: `https://openai.com/api/pricing/`
- models.dev model metadata: `https://models.dev`
