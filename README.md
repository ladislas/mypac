# mypac

**mypac** stands for **My Personal AI Config**. It is an opinionated package of reusable [Pi](https://github.com/badlogic/pi-mono/tree/main/packages/pi-coding-agent) assets for coding workflows.

Use it as a personal lab, install it as a Pi package, or browse it for extensions, prompts, skills, personas, and themes worth adapting to your own setup.

## What you get

- **Extensions** add commands, tools, UI flows, and workflow guardrails.
- **Skills** encode repeatable repository and GitHub workflows.
- **Prompts** expose common work modes as slash commands.
- **Personas and themes** customize communication and presentation.

See the complete [asset catalog](docs/catalog.md).

## Quick start

### 1. Clone and set up the environment

Install [`mise`](https://mise.jdx.dev/) and [Pi](https://github.com/earendil-works/pi) first. Configure persistent [mise activation](https://mise.jdx.dev/cli/activate.html) or [shims](https://mise.jdx.dev/dev-tools/shims.html), then run:

```sh
git clone https://github.com/ladislas/mypac.git
cd mypac
./scripts/install.sh
```

The setup installs checkout dependencies and Git hooks, registers mypac with Pi, and reconciles the pinned global tools and Pi packages declared in [`.mise/global-environment`](.mise/global-environment).

After pulling changes, reapply the declared global environment with:

```sh
mise run --skip-tools sync
```

Sync installs declared versions but never automatically removes components deleted from the declaration. Use the relevant native package manager when intentional cleanup is needed.

### 2. Try a workflow

```text
/pac-hello-world
/pac-llat a target to classify
/pac-lwot a concrete task to implement
```

To launch Pi inside this repository, run:

```sh
mise run pi
```

## Common workflows

| Command | Purpose |
| --- | --- |
| `/pac-llat` | Classify a target and route it to the appropriate workflow |
| `/pac-lwot` | Execute work from an issue, PRD, URL, or conversation |
| `/pac-grill-with-docs` | Refine issue-backed work and preserve decisions |
| `/pac-to-prd` | Turn context into a product requirements document |
| `/pac-to-issues` | Split an agreed plan into implementation issues |
| `/review-start` | Review code changes from inside Pi |

The [asset catalog](docs/catalog.md) lists every available command and resource.

## Documentation

- [Asset catalog](docs/catalog.md) — extensions, skills, prompts, personas, and themes
- [Development guide](docs/development.md) — repository setup, tooling, hooks, and maintenance
- [Integrations](docs/integrations.md) — optional tools such as Headroom
- [Changelog](CHANGELOG.md) — notable repository changes

## Repository layout

```text
extensions/  Pi extensions and tools
prompts/     Slash-command prompt templates
skills/      Reusable workflow instructions
personas/    Runtime persona prompt content
themes/      Pi themes
```

## Status

This is a living repository. Prefer evergreen principles, repeatable experiments, and dated decisions over static vendor snapshots.

## Inspiration and attribution

Ideas are happily stolen, reviewed, modified, and improved from:

- [mitsuhiko/agent-stuff](https://github.com/mitsuhiko/agent-stuff)
- [mattpocock/skills](https://github.com/mattpocock/skills)
- the broader Pi ecosystem

## License

Released under the [MIT License](LICENSE).
