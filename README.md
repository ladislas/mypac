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
On a fresh clone, install Node dependencies with `npm ci` before launching Pi so repo extensions can load cleanly.

```bash
npm ci
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
- Install Node dependencies with `npm ci` in the cloned repo before relying on any repo-provided Pi extensions.
- Do not replace existing entries in `~/.pi/agent/settings.json`; only add the `mypac` repo path to the `packages` array if it is missing.
- If you hit an auth, permission, or missing-tool problem, stop and tell me exactly what you need from me.

Tasks:
1. Confirm where I want to clone `https://github.com/ladislas/mypac.git`, then clone it there.
2. From the cloned repository root, run `npm ci` to install Node dependencies.
3. Read the cloned `README.md` and follow the documented setup for this repo.
4. Ensure `~/.pi/agent/settings.json` exists and that its `packages` array includes the cloned repository path.
5. From the repository root, run:
   - `mise trust`
   - `mise install`
   - `mise run hooks`
6. Verify the setup by:
   - confirming `npm ci` completed successfully
   - confirming the package path was added to `~/.pi/agent/settings.json`
   - confirming the repo contains `prompts/`, `extensions/`, and `skills/`
   - telling me to launch Pi in the repo with `mise run pi`
   - once Pi is running from the repo, asking me to try `/pac-hello-world`
   - telling me whether I need to restart Pi so it reloads the updated package settings
7. Summarize what you changed, what you verified, and any follow-up steps for me.

If `mise` is not installed and I want you to install it, use Homebrew: `brew install mise`.
```

This is meant to be copy-pasted as-is so Pi can handle the repository-specific setup instead of making you translate the README into agent instructions by hand.

## Why this exists

- Build a reliable personal AI operating system
- Turn experiments into repeatable workflows
- Document progress and lessons over time

## Status

Living repository. Prefer evergreen principles, repeatable experiments, and dated decisions over static vendor snapshots.
