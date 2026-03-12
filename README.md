# mypaa

**mypaa** stands for **My Personal AI Agent**.

This repository is my personal lab for building an AI-native way of working.
I use it to collect knowledge, configs, prompts, and experiments from my agentic journey.

## What lives here

- Notes, playbooks, and learning resources
- Agent prompts, templates, and workflows
- Tooling/config setup and reusable snippets
- Experiment logs, results, and retrospectives

## Start here

- Strategy overview: `docs/vision/agent-strategy.md`
- Model routing playbook: `docs/playbooks/model-routing.md`
- OpenSpec playbook: `docs/playbooks/openspec.md`
- Default interface decision: `docs/decisions/ADR-0001-default-interface-opencode.md`

These docs are intentionally lightweight and biased toward durable ideas over fast-changing vendor details.

## Repository Tooling

- Install `mise` with Homebrew: `brew install mise`
- Trust the repo tool config: `mise trust`
- Install repo-managed tools: `mise install`
- Install the git hook: `mise x -- pre-commit install`
- Run the checks on demand: `mise x -- pre-commit run --all-files`

The pre-commit configuration validates YAML files and lints Markdown files before commit.
If a check fails, fix the reported file and run the hook again or retry the commit.

## Why this exists

- Build a reliable personal AI operating system
- Turn experiments into repeatable workflows
- Document progress and lessons over time

## Status

Living repository. Prefer evergreen principles, repeatable experiments, and dated decisions over static vendor snapshots.
