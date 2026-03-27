## Why

The repository currently relies on `pre-commit` for YAML and Markdown validation, but the rest of the workflow is already centered on `mise`. Migrating to `hk` aligns the hook runner with your preferred tooling, keeps the local setup simpler, and preserves the existing validation guarantees while making room for stronger YAML linting.

## What Changes

- Replace the repository's `pre-commit` hook runner with an `hk` configuration.
- Add `mise`-managed tasks for installing hooks and running Markdown and YAML checks manually.
- Replace syntax-only YAML checking with `yamllint` for stricter repository YAML validation.
- Extend Markdown lint overrides so OpenSpec files under `openspec/` are linted with the right scoped configuration.
- Update contributor documentation to describe the new `hk`-based bootstrap and manual lint workflow.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `content-precommit-validation`: Replace the `pre-commit`-specific workflow with `hk`, strengthen YAML validation with `yamllint`, and document the new setup and scoped Markdown lint overrides.

## Impact

- Affected files: hook configuration, `mise` tooling config, Markdown lint config, README guidance, and OpenSpec specs for repository content validation.
- New or changed dependencies: `hk`, `pkl`, and `yamllint` managed through `mise`.
- Contributor workflow changes: hook installation and manual lint commands will use `hk`/`mise` instead of `pre-commit`.
