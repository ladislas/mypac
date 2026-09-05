# Development guide

This guide covers contributor setup and repository maintenance. For package usage, start with the [README](../README.md).

## Prerequisites

The host substrate is Git, [Pi](https://github.com/earendil-works/pi), and [`mise`](https://mise.jdx.dev/). Host-provided Node.js or npm are not required; bootstrap installs the exact Node foundation (including its bundled npm) and uv through mise before running checkout npm commands.

On macOS, Homebrew may provide the host substrate:

```sh
brew install git mise
```

Configure [mise activation](https://mise.jdx.dev/cli/activate.html) or [mise shims](https://mise.jdx.dev/dev-tools/shims.html) persistently before bootstrap. This is a hard prerequisite; mypac verifies it and never edits shell startup files.

For a fresh machine, prefer Pi's standalone installer so installing Pi does not require Node:

```sh
curl -fsSL https://pi.dev/install.sh | sh
```

An existing npm-installed Pi remains supported.

## Repository setup

From a fresh clone, run:

```sh
./scripts/install.sh
```

The script sets `MISE_TASK_RUN_AUTO_INSTALL=false` before invoking `mise run bootstrap`, disabling mise task auto-install so checkout-local tools cannot be installed before bootstrap owns the phase ordering. Bootstrap then runs these fixed phases:

1. validate persistent mise integration and the single desired-state declaration;
2. reconcile the exact Node foundation (including bundled npm) and uv, then activate it in the bootstrap process;
3. verify Pi is available and report its installed and mypac-tested versions;
4. install checkout npm dependencies, checkout-local mise tools, and Git hooks;
5. reconcile gh, Worktrunk, Headroom, and agent-browser applications;
6. reconcile Pi packages and register mypac;
7. run agent-browser-owned browser setup and final runtime verification.

Current mise behavior auto-trusts the active configuration for explicit `mise run` and `mise install` commands, so no separate pre-trust step is required.

Launch Pi with the local package loaded:

```sh
mise run pi
```

If Pi was already running when package files changed, use `/reload` or restart it.

## Tooling

```sh
mise install                       # install checkout-local development tools
mise run deps                      # reconcile checkout-local Node dependencies
mise run --skip-tools sync         # reconcile global runtime state without pre-installing checkout tools
mise run hooks                     # install Git hooks
mise run lint                      # run repository linters
mise run lint:fix
mise run chatgpt-skills:export     # build and reference-validate upload-ready skill packages
npm run check:pi-compatibility     # verify pinned Pi versions, types, and behavior
```

Global desired state lives in [`.mise/global-environment`](../.mise/global-environment). To upgrade a managed tool, change only its exact specification there, then run `mise run --skip-tools sync` and the repository tests. The Node declaration owns the Node artifact and its bundled npm; npm has no separate desired-state pin. Final verification checks that npm resolves from the same mise-managed Node installation without hard-coding a second npm version. Removing a declaration stops future reconciliation but does not uninstall an existing global component.

Ownership remains deliberately narrow:

```text
Homebrew/OS → Git, mise, Pi, shell/system software, optional system capabilities
mise        → Node (including bundled npm), uv, gh, Worktrunk, Headroom, agent-browser
Pi          → mypac, pi-agent-browser-native, pi-codex-search, pi-computer-use (disabled by default)
npm         → mypac checkout dependencies
mypac       → desired-state declaration and thin phase orchestration
```

Bootstrap does not run `wt config shell install` or edit shell files. Worktrunk shell integration is optional when invoking raw `wt` commands that must switch the parent shell's directory. It is unnecessary for mypac's current `/worktree` extension, which uses `--no-cd` and prints an explicit `cd` command.

Bootstrap can activate newly installed tools only inside its own child process; it cannot prove how a future parent shell will initialize. After setup, test a fresh login shell from an unrelated repository:

```sh
acceptance_dir="$(mktemp -d)"
git -C "$acceptance_dir" init --quiet
(
  cd "$acceptance_dir"
  "$SHELL" -lic '
    set -e
    for command in node npm uv gh wt headroom agent-browser; do
      command -v "$command"
      "$command" --version
    done
  '
)
```

Each independently declared command must report its declared version; npm must resolve alongside the pinned Node installation and report the version bundled with that Node artifact. If resolution is wrong, fix mise activation or shim ordering in the user-owned shell configuration and start another fresh shell.

CI runs the Pi compatibility gate after `npm ci`, so its version, type, and behavior checks execute against a clean dependency installation. Run the same command locally before upgrading Pi dependencies.

## Pi upgrade checklist

Use this checklist whenever changing the pinned Pi version:

1. Record the old pin, target pin, and exact repository commit being audited.
2. List every intervening stable Pi release. Review each release changelog and inspect versioned documentation, types, examples, or source where the changelog does not establish impact.
3. Maintain a release ledger that classifies every release, including releases with no applicable mypac changes.
4. Map relevant changes to affected extensions, skills, prompts, themes, package metadata, and tests. Classify each response as migration, replacement, improvement, verification only, or not applicable.
5. Create capability-based implementation issues with explicit dependencies for the agreed work. Keep the upgrade branch pinned to exact Pi and TypeBox versions.
6. Install dependencies cleanly and run `npm run check:pi-compatibility`. Add focused regression coverage for every compatibility defect found.
7. Run focused manual checks for behavior that automation cannot approve: regular and fullscreen rendering, themes, overlays, scrolling, focus, resize, shortcuts, provider routing, notifications, reload, session replacement, trust, and shutdown.
8. Record the effective dependency versions, automated result, test environment, manual observations, follow-up issues, and exact implementation commit.
9. Compare the audited commit with current `main`. Review intervening changes and rerun affected automated or manual checks when runtime, dependency, configuration, or test behavior changed.
10. Obtain explicit human approval before merging or declaring the upgrade complete.

The Git hooks lint Markdown and YAML. They also reject merges or pushes to `main` when incoming commits contain `fixup!` subjects. Fix the reported problem rather than bypassing hooks.

## Repository resources

| Path | Contents |
| --- | --- |
| [`extensions/`](../extensions/) | Pi extension entry points and colocated helpers/tests |
| [`prompts/`](../prompts/) | Slash-command prompt templates |
| [`skills/`](../skills/) | Reusable task instructions and supporting references |
| [`personas/`](../personas/) | Persona prompt content loaded by the personas extension |
| [`themes/`](../themes/) | Pi theme definitions |
| [`shared/`](../shared/) | Instructions shared across repository sessions |

Read [`AGENTS.md`](../AGENTS.md) before changing the repository. Specialized authoring guidance lives in:

- [`pac-pi-extension`](../skills/pac-pi-extension/SKILL.md)
- [`pac-pi-prompt`](../skills/pac-pi-prompt/SKILL.md)
- [`pac-pi-skill`](../skills/pac-pi-skill/SKILL.md)

## Git workflow

Keep `main` clean. Work on a branch named:

```text
<firstname>/<type>/<topic-more_info>
```

For issue-backed work, include the issue number:

```text
<firstname>/<type>/<issue-number>-<topic-more_info>
```

Commits use gitmoji subjects:

```text
<emoji> <type>(<scope>): <summary>
```

See [`pac-commit`](../skills/pac-commit/SKILL.md) for staging, commit splitting, and hook guidance.

## Changelog

Record notable changes under `## [Unreleased]` in [`CHANGELOG.md`](../CHANGELOG.md). Keep entries concise and group them under headings such as `Added`, `Changed`, and `Fixed`.

See [`pac-changelog`](../skills/pac-changelog/SKILL.md) for the full workflow.

## Agent-assisted first-time setup

If Pi is already available elsewhere on the machine, this prompt can delegate repository onboarding while preserving existing global settings:

```text
Please set up the `mypac` repository on this machine.

Important:
- Ask for missing values before acting, especially the clone location and
  permission to install prerequisites.
- Stop and explain any authentication, permission, or missing-tool problem.

Tasks:
1. Confirm where to clone https://github.com/ladislas/mypac.git, then clone it.
2. Read README.md and follow the documented repository setup.
3. From the repository root, run ./scripts/install.sh.
4. Explain how to launch Pi with mise run pi.
5. Ask me to validate the package with /pac-hello-world.
6. Explain whether Pi must be reloaded or restarted.
7. Summarize changes, verification, and follow-up steps.

If mise is missing and I approve installation on macOS, use:
brew install mise
```
