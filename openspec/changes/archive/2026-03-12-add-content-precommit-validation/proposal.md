# Proposal

## Why

YAML and Markdown files in this repository define automation inputs, OpenSpec metadata, prompts, and long-lived documentation, but they are currently not validated before commit. Adding repository-managed pre-commit checks reduces avoidable syntax and linting issues while also creating a lightweight example of how to use OpenSpec to evolve repo tooling.

## What Changes

- Add a repository-level `pre-commit` configuration that validates YAML files and lints Markdown files before commits are created.
- Add a repository-managed `mise` configuration so contributors can install `pre-commit` without manually managing Python or other language runtimes.
- Add root and `.opencode/` Markdown lint configuration files that keep the initial ruleset useful without being noisy for existing front matter-driven prompts.
- Define expected contributor setup and remediation steps when YAML or Markdown checks fail.

## Capabilities

### New Capabilities

- `content-precommit-validation`: Validate repository YAML and Markdown content during pre-commit so invalid or non-compliant files are rejected before commit.

### Modified Capabilities

## Impact

- Affects repository contribution workflow and local git hook execution.
- Introduces or standardizes `mise.toml`, `.pre-commit-config.yaml`, `.markdownlint.yaml`, and `.opencode/.markdownlint.yaml`.
- Reduces the chance of broken OpenSpec metadata, malformed YAML, or drifting Markdown conventions entering the repository.
