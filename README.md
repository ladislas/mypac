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
On a fresh clone, run the setup script from the repository root before launching Pi:

```bash
./scripts/install.sh
```

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

External Pi extensions used alongside this repo:

- [`@eko24ive/pi-ask`](https://github.com/eko24ive/pi-ask) — interactive `ask_user` clarification flow

On a fresh install, run the setup script from the `mypac` checkout:

```bash
./scripts/install.sh
```

This installs repo dependencies, repo-managed tools, git hooks, and the external Pi extensions listed above.

If Pi is already running after the install, use `/reload` or restart Pi.

Shared pi resource locations in this repository:

- `prompts/`
- `extensions/`
- `skills/`

The first validation prompt is:

- `/pac-hello-world`

A useful working prompt is:

- `/pac-lwot [optional text|github issue|github pr|url]`

## Ask Pi to do the first-time setup

If you already have Pi running elsewhere and want it to onboard `mypac` for you, paste this into Pi:

```text
Please set up the `mypac` repository on this machine.

Important:
- Ask me for any missing values before acting, especially the clone location and whether you should install any missing prerequisites.
- From the cloned repo root, run `./scripts/install.sh` to install repo dependencies, tooling, hooks, and the external Pi extensions documented in `README.md`.
- Do not replace existing entries in `~/.pi/agent/settings.json`; only add the `mypac` repo path to the `packages` array if it is missing.
- If you hit an auth, permission, or missing-tool problem, stop and tell me exactly what you need from me.

Tasks:
1. Confirm where I want to clone `https://github.com/ladislas/mypac.git`, then clone it there.
2. Read the cloned `README.md` and follow the documented setup for this repo.
3. Ensure `~/.pi/agent/settings.json` exists and that its `packages` array includes the cloned repository path.
4. From the cloned repository root, run `./scripts/install.sh`.
5. Tell me to launch Pi in the repo with `mise run pi`.
6. Once Pi is running from the repo, ask me to try `/pac-hello-world`.
7. Tell me whether I need to restart Pi so it reloads the updated package settings.
8. Summarize what you changed, what you verified, and any follow-up steps for me.

If `mise` is not installed and I want you to install it, use Homebrew: `brew install mise`.
```

This is meant to be copy-pasted as-is so Pi can handle the repository-specific setup instead of making you translate the README into agent instructions by hand.

## Why this exists

- Build a reliable personal AI operating system
- Turn experiments into repeatable workflows
- Document progress and lessons over time

## Status

Living repository. Prefer evergreen principles, repeatable experiments, and dated decisions over static vendor snapshots.
