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
- Adversarial review should first gain independence from fresh delegated context, not from automatic model churn.
- If the runtime later supports explicit delegated model override, treat it as an optional strengthening step rather than the default path.
- For the strongest practical independence, run the adversarial pass in a fresh session instead of assuming model change alone is enough.

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
