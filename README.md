# mypac

**mypac** stands for **My Personal AI Config**.

This repository is my personal lab for building an AI-native way of working.
I use it to collect knowledge, configs, prompts, and experiments for my personal AI workflow.

It also doubles as a reusable OpenCode kit that can be loaded from other repositories through `OPENCODE_CONFIG_DIR`.

## What lives here

- Notes, playbooks, and learning resources
- Agent prompts, templates, and workflows
- Tooling/config setup and reusable snippets
- Experiment logs, results, and retrospectives

## Start here

- Strategy overview: `docs/vision/agent-strategy.md`
- Model routing playbook: `docs/playbooks/model-routing.md`
- OpenSpec playbook: `docs/playbooks/openspec.md`
- Shared kit playbook: `docs/playbooks/shared-opencode-kit.md`
- Default interface decision: `docs/decisions/ADR-0001-default-interface-opencode.md`

## Review workflows

- Use `/pac-review` for the default structured review pass on most changes. It is meant to catch correctness issues, scope drift, maintainability concerns, and missing verification.
- Use `/pac-review-adversarial` when you want a more skeptical pass aimed at hidden assumptions, subtle failure modes, rollback risk, and false confidence.
- Use both for higher-risk changes: run `/pac-review` first to establish the baseline, then `/pac-review-adversarial` to pressure-test the same change independently.
- Both workflows are analysis only. They review in fresh delegated context by default and should not edit files or apply fixes.
- For maximum adversarial independence, prefer running `/pac-review-adversarial` in a fresh session.

These docs are intentionally lightweight and biased toward durable ideas over fast-changing vendor details.

## Repository Tooling

- Install `mise` with Homebrew: `brew install mise`
- Trust the repo tool config: `mise trust`
- Install repo-managed tools: `mise install`
- Install the git hook: `mise run hooks`
- Run the checks on demand: `mise run lint`
- Auto-fix Markdown lint issues: `mise run lint:fix`

The hk configuration lints YAML and Markdown files before commit.
If a check fails, fix the reported file and run the hook again or retry the commit.

## Reusing this repository as a shared OpenCode kit

The reusable OpenCode kit lives at the repository root in this repository.

For day-to-day work in this repo, use the supported launcher:

```bash
mise run opencode
```

Use it from another repository like this:

```bash
export OPENCODE_CONFIG_DIR=/path/to/mypac
```

That loads the shared agents, commands, plugins, and skills from this repo while keeping the target repository's local `.opencode/` content additive.

Shared asset locations:

- `agents/`
- `commands/`
- `plugins/`
- `skills/`

Manual `OPENCODE_CONFIG_DIR=... opencode` exports are still useful as compatibility context, but `mise run opencode` is the supported local workflow here.

For naming and layering rules, see `docs/playbooks/shared-opencode-kit.md`.

## Why this exists

- Build a reliable personal AI operating system
- Turn experiments into repeatable workflows
- Document progress and lessons over time

## Status

Living repository. Prefer evergreen principles, repeatable experiments, and dated decisions over static vendor snapshots.
