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
- Use `/pac-review-mixed` when you want the explicit comparison path. It runs standard and adversarial reviews in parallel and returns a synthesized comparison and verdict.
- All review workflows are analysis only. They do not edit files or apply fixes.
- Review packets are evidence-first: derive requested target, branch, base branch, diff source, and active OpenSpec change from observable context in that order, and keep unknowns explicit instead of guessing.
- Standard and adversarial reviews run as named subagents (`pac-reviewer-standard`, `pac-reviewer-adversarial`) invoked via the Task tool. Each runs in an isolated child session with read-only permissions — this is structural isolation, not just an instruction to "try to stay independent."
- `/pac-review-mixed` invokes both named subagents in parallel from the same normalized packet, then synthesizes the comparison in the main thread after both return.
- For the strongest practical adversarial independence, prefer running `/pac-review-adversarial` in a fresh session. The named subagent gives session isolation from the main thread; a fresh outer session removes any shared ambient context from prior work in the same conversation.
- Adversarial review carries a configured model (`github-copilot/claude-sonnet-4.6`) for future routing differentiation. In v1 this is the same as the default model. Route status is reported as `unavailable` until a distinct alternate route is configured.
- If a Task tool invocation cannot be confirmed as a fresh child session, the review reports that degraded mode and lowers confidence instead of implying the ideal path happened.

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
