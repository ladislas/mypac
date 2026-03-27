## Context

`mypac` currently validates repository Markdown and YAML content through a `pre-commit` configuration managed with `mise`. The migration needs to preserve the existing contributor safety net, keep setup simple for a fresh clone, and avoid dragging in project-specific hook logic from other repositories. The main technical wrinkle is that the repository currently uses syntax-only YAML validation and has scoped Markdown overrides for `.opencode/` and `openspec/changes/`, but not for the `openspec/` tree as a whole.

## Goals / Non-Goals

**Goals:**

- Replace `pre-commit` with `hk` as the versioned hook runner.
- Keep `mise` as the single contributor-facing bootstrap path for tools and manual lint commands.
- Strengthen YAML validation by switching from syntax-only checks to `yamllint`.
- Preserve Markdown linting and add the missing scoped override for `openspec/` files.
- Keep the migration small and local to repository tooling and docs.

**Non-Goals:**

- Introducing unrelated project-specific checks from other repositories.
- Reworking existing Markdown lint rules beyond the scoped override needed for OpenSpec files.
- Reorganizing the repository's broader documentation or OpenSpec skill scaffolding.

## Decisions

### Use `hk` with a checked-in `.config/hk.pkl`

The hook runner will move from `.pre-commit-config.yaml` to `.config/hk.pkl`.

- Why: `hk` is the intended replacement, and a checked-in config keeps hook behavior versioned in the repository.
- Alternative considered: keep `pre-commit` and only add wrapper tasks. Rejected because it preserves the old runner instead of completing the migration.

### Keep `mise` as the single bootstrap surface

The repository will install `hk`, `pkl`, `markdownlint-cli2`, and `yamllint` through `mise`, and expose `mise` tasks for hook installation and manual lint runs.

- Why: contributors already bootstrap with `mise`, so the migration should reduce moving parts instead of adding a second setup path.
- Alternative considered: document raw `hk` commands without `mise` tasks. Rejected because it makes setup and recurring usage less discoverable.

### Use `yamllint` for repository YAML validation

YAML validation will use `yamllint` against tracked `.yml` and `.yaml` files.

- Why: this is a deliberate behavior upgrade over syntax-only parsing and matches the desired policy change.
- Alternative considered: replicate `check-yaml` parity with a lighter check. Rejected because the goal is to gain stricter YAML hygiene during the migration.

### Add an `openspec/` Markdown lint override

The repository will add `openspec/.markdownlint.yaml` extending the root config and disabling `MD041` for OpenSpec artifacts.

- Why: OpenSpec files commonly start with front matter or generated structure that does not begin with a top-level heading, and the repository currently only handles this under `openspec/changes/`.
- Alternative considered: rely on the `openspec/changes/` override only. Rejected because it leaves other OpenSpec markdown paths uncovered.

## Risks / Trade-offs

- [Stricter YAML linting surfaces new failures] → Add a repo-local `.yamllint.yaml` tuned to current repository conventions and fix any violations discovered during migration.
- [Hook migration changes contributor muscle memory] → Update README commands so the setup flow and manual lint commands are obvious.
- [Over-copying from another repository introduces irrelevant complexity] → Pull only the generic hk/mise patterns and keep the config minimal to `mypac`'s actual checks.
