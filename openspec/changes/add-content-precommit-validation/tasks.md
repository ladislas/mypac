# Implementation Tasks

## 1. Tool Bootstrap

- [x] 1.1 Add a `mise.toml` file that installs `pre-commit` for this repository
- [x] 1.2 Add a repository-managed `.pre-commit-config.yaml` that validates YAML and lints Markdown

## 2. Lint Configuration

- [x] 2.1 Add a root `.markdownlint.yaml` with the agreed baseline rules for this repository
- [x] 2.2 Add a `.opencode/.markdownlint.yaml` override that extends the root config and disables `MD041`

## 3. Contributor Guidance

- [x] 3.1 Document the `brew install mise`, `mise trust`, `mise install`, and `pre-commit` hook setup flow for contributors
- [x] 3.2 Document the expected developer workflow when YAML or Markdown checks fail during commit

## 4. Verification

- [x] 4.1 Run the configured hooks against the repository to confirm YAML validation and Markdown linting pass with the new configuration
- [x] 4.2 Verify the repository state and changed docs/config clearly reflect the new content validation workflow
