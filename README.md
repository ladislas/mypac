# mypac

**mypac** stands for **My Personal AI Config**.

This repository is my personal lab for building an AI-native way of working.
I use it to collect knowledge, configs, prompts, and experiments for my personal AI workflow.

It is set up to be used with **[pi](https://github.com/badlogic/pi-mono/tree/main/packages/pi-coding-agent)**.

## What lives here

- Notes, playbooks, and learning resources
- Agent prompts, templates, and workflows
- Tooling/config setup and reusable snippets
- Experiment logs, results, and retrospectives

## Start here

For day-to-day work in this repo, the README is the source of truth.
Use Pi locally with:

```bash
mise run pi
```

Use OpenSpec for meaningful multi-step work.
OpenSpec artifacts live under `openspec/`.

## Repository Tooling

- Install `mise` with Homebrew: `brew install mise`
- Trust the repo tool config: `mise trust`
- Install repo-managed tools: `mise install`
- Install the git hook: `mise run hooks`
- Run the checks on demand: `mise run lint`
- Auto-fix Markdown lint issues: `mise run lint:fix`

The hk configuration lints YAML and Markdown files before commit.
If a check fails, fix the reported file and run the hook again or retry the commit.

## Using this repository with pi

To make `mypac` available from any repository, add this repo as a local pi package in `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "/Users/ladislas/dev/ladislas/mypac"
  ]
}
```

If you already have other packages configured, append this repository path to the existing `packages` array instead of replacing it.

This keeps pi using its normal runtime state in `~/.pi/agent/` for auth, settings, and sessions while loading shared resources from this repository.

Shared pi resource locations in this repository:

- `prompts/`
- `extensions/`
- `skills/`

The first validation prompt is:

- `/hello-world`

## Why this exists

- Build a reliable personal AI operating system
- Turn experiments into repeatable workflows
- Document progress and lessons over time

## Status

Living repository. Prefer evergreen principles, repeatable experiments, and dated decisions over static vendor snapshots.
