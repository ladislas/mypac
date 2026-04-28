# mypac

**mypac** stands for **My Personal AI Config**.

It is an opinionated package of reusable **Pi** assets: extensions, prompts, and skills for coding workflows.
This repo is both my personal lab and a browsable catalog for people who want to discover, copy, or install useful Pi building blocks.

It is set up to be used with **[pi](https://github.com/badlogic/pi-mono/tree/main/packages/pi-coding-agent)**.

## Why this repo is useful

If you are evaluating this repository, the main things to look at are:

- **Extensions** that add Pi commands, tools, UI flows, and workflow guardrails
- **Skills** that encode repeatable repo and GitHub workflows
- **Prompts** that turn common work modes into slash commands

In short: this is a small shop of reusable Pi assets for planning, implementation, review, GitHub work, and day-to-day repo operations.

## Asset catalog

Repo-local prompts and skills use the `pac-` prefix to avoid collisions with other tools and packages.
That is a good tradeoff here because Pi's fuzzy slash-command finder makes the longer names easy to type anyway.
For readability, the skill table below drops the `pac-` prefix in the display label, while the prompt table keeps the real slash commands you actually type.

### Extensions

| Extension | Surface | What it adds |
| --- | --- | --- |
| [`answer`](extensions/answer/) | `/answer`, `ctrl+.` | Extracts questions from the last assistant message and lets you answer them in an interactive Q&A flow |
| [`ask`](extensions/ask/) | `/ask` | Toggles a discussion-only mode so you can think things through without making changes |
| [`btw`](extensions/btw/) | `/btw` | Opens an isolated side conversation for planning, exploration, and handoff back to the main thread |
| [`commit`](extensions/commit/) | `/commit` | Guides atomic commits that follow the repo's gitmoji and staging rules |
| [`context`](extensions/context/) | `/context` | Shows loaded context and tracks which repo-local skills have been pulled into the session |
| [`files`](extensions/files/) | `/files`, shortcuts | Browses repo and session files, with quick actions like open, reveal, diff, edit, and add to prompt |
| [`ghi`](extensions/ghi/) | `/ghi` | Creates a GitHub issue in the current repository using `gh` |
| [`multi-edit`](extensions/multi-edit/) | `edit` tool override | Extends Pi's `edit` tool with batch edits and Codex-style patch support |
| [`review`](extensions/review/) | `/review`, `/end-review` | Reviews uncommitted changes, commits, branches, PRs, or folders from inside Pi |
| [`session-names`](extensions/session-names/) | background behavior | Names `/pac-lwot` sessions from the work context you provide |
| [`shared-agents`](extensions/shared-agents/) | background behavior | Injects shared `AGENTS.md` guidance into the session system prompt |
| [`todos`](extensions/todos/) | `todo` tool, `/todos` | Adds a file-based todo system under `.pi/todos` with claiming, status, and notes |
| [`undo`](extensions/undo/) | `/undo` | Rewinds to the previous user message and restores it to the editor |
| [`uv`](extensions/uv/) | `bash` tool wrapper | Redirects Python package and interpreter workflows toward `uv` |
| [`whimsical`](extensions/whimsical/) | background behavior | Rotates fun working messages while Pi is running |

### Skills

| Skill | What it is for |
| --- | --- |
| [`changelog`](skills/pac-changelog/SKILL.md) | Update `CHANGELOG.md` for notable changes and prepare release sections on request |
| [`commit`](skills/pac-commit/SKILL.md) | Create, split, or plan commits that follow this repo's branch, staging, and gitmoji workflow |
| [`github`](skills/pac-github/SKILL.md) | Use the `gh` CLI for issues, PRs, workflow runs, and GitHub API queries |
| [`github-issue-create`](skills/pac-github-issue-create/SKILL.md) | Create well-formed GitHub issues from inside the current repository |
| [`librarian`](skills/pac-librarian/SKILL.md) | Cache and refresh remote git repositories locally for future reference work |
| [`openspec-apply-change`](skills/pac-openspec-apply-change/SKILL.md) | Implement tasks from an OpenSpec change |
| [`openspec-archive-change`](skills/pac-openspec-archive-change/SKILL.md) | Archive a completed OpenSpec change |
| [`openspec-explore`](skills/pac-openspec-explore/SKILL.md) | Explore ideas, investigate problems, and clarify requirements before coding |
| [`openspec-propose`](skills/pac-openspec-propose/SKILL.md) | Generate a full OpenSpec proposal with design, specs, and tasks |
| [`pi-extension`](skills/pac-pi-extension/SKILL.md) | Create or refactor Pi extensions safely in this repo's extension layout |
| [`pi-prompt`](skills/pac-pi-prompt/SKILL.md) | Author or update prompt templates under `prompts/` |
| [`pi-skill`](skills/pac-pi-skill/SKILL.md) | Create, rename, or refactor repo-local skills under `skills/` |
| [`review`](skills/pac-review/SKILL.md) | Review code changes using the repo's review rubric |
| [`uv`](skills/pac-uv/SKILL.md) | Prefer `uv` over `pip`, `python`, and `venv` workflows |

### Prompts

| Prompt | Purpose |
| --- | --- |
| [`/pac-hello-world`](prompts/pac-hello-world.md) | Quick validation prompt to confirm the package is loaded |
| [`/pac-lwot`](prompts/pac-lwot.md) | "Let's work on that" — turn a note, issue, PR, todo, or URL into a concrete plan and next steps |
| [`/pac-ldit`](prompts/pac-ldit.md) | "Let's do it" — confirm and proceed with already-planned work |
| [`/pac-propose`](prompts/pac-propose.md) | Create a new OpenSpec change proposal in one step |
| [`/pac-apply`](prompts/pac-apply.md) | Implement tasks from an OpenSpec change |
| [`/pac-explore`](prompts/pac-explore.md) | Enter exploration mode to think through a problem before implementation |
| [`/pac-archive`](prompts/pac-archive.md) | Archive a completed OpenSpec change |

## Getting started

### Repo setup

On a fresh clone, run the setup script from the repository root:

```bash
./scripts/install.sh
```

Launch Pi locally with:

```bash
mise run pi
```

Use OpenSpec for meaningful multi-step work.
OpenSpec artifacts live under `openspec/`.

### Use this repo as a local Pi package

To make `mypac` available from any repository, add this repo as a local Pi package in `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "/Users/ladislas/dev/ladislas/mypac"
  ]
}
```

If you already have other packages configured, append this repository path to the existing `packages` array instead of replacing it.

This keeps Pi using its normal runtime state in `~/.pi/agent/` for auth, settings, and sessions while loading shared resources from this repository.

External Pi extensions used alongside this repo:

- [`@eko24ive/pi-ask`](https://github.com/eko24ive/pi-ask) — interactive `ask_user` clarification flow

After install, if Pi is already running, use `/reload` or restart Pi.

Useful first commands:

- `/pac-hello-world`
- `/pac-lwot [optional text|github issue|github pr|url]`

### Repository tooling

- Install `mise` with Homebrew: `brew install mise`
- Trust the repo tool config: `mise trust`
- Install repo-managed tools: `mise install`
- Install the git hook: `mise run hooks`
- Run the checks on demand: `mise run lint`
- Auto-fix Markdown lint issues: `mise run lint:fix`

The hk configuration lints YAML and Markdown files before commit.
If a check fails, fix the reported file and run the hook again or retry the commit.

### Changelog

- Track notable repository changes in [`CHANGELOG.md`](CHANGELOG.md).
- For agent-driven work, use [`skills/pac-changelog/SKILL.md`](skills/pac-changelog/SKILL.md) to update `## [Unreleased]` before merge.
- Keep entries grouped under headings like `Added`, `Changed`, and `Fixed`.

### Shared resource locations

The main Pi resource directories in this repository are:

- `prompts/`
- `extensions/`
- `skills/`

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
- Keep useful Pi assets in one place instead of rediscovering them
- Document progress and lessons over time

## Status

Living repository. Prefer evergreen principles, repeatable experiments, and dated decisions over static vendor snapshots.

## Inspiration and attribution

Happily stolen, reviewed, modified, or improved from:

- [mitsuhiko/agent-stuff](https://github.com/mitsuhiko/agent-stuff) — source material and inspiration for several extensions and workflow ideas
- [@eko24ive/pi-ask](https://github.com/eko24ive/pi-ask) — interactive `ask_user` extension used alongside this repo
- The broader Pi ecosystem and its extension, prompt, and workflow patterns

## License

Released under the [MIT License](LICENSE).
