# Agent Strategy

## Core beliefs

- Harness > model for day-to-day output quality.
- Portability beats lock-in; keep providers swappable.
- Token quota and token cost are workflow problems, not just model problems.

In API mode, this is mostly a dollar-cost optimization problem.
In flat-rate subscription mode, this is mostly a quota/rate-limit optimization problem.

## Operating principles

- Use one default interface and one default working setup.
- Route cheap models to search and summarize only (see `docs/playbooks/model-routing.md`).
- Escalate to strong models only when stuck.
- Prefer small, explicit context over broad scans.

## Governance

- Cap exploration depth per task.
- Require summaries between loops.
- Avoid auto-scanning entire repos by default.

## Review cadence

- Weekly: record what worked and what burned quota/tokens.
- Monthly: refresh routing rules and benchmark results.

## Durability rule

- Keep principles here; keep volatile vendor facts out.
- If a document depends on current model names, prices, or quotas, treat it as a live reference, not durable knowledge.
