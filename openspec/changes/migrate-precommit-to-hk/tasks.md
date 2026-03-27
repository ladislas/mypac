## 1. Hook runner migration

- [x] 1.1 Replace the `pre-commit` configuration with an `hk` configuration scoped to this repository's Markdown and YAML checks
- [x] 1.2 Add `mise`-managed tooling and tasks for installing hooks and running Markdown and YAML checks manually
- [x] 1.3 Add the missing `openspec/.markdownlint.yaml` override and any supporting lint config needed by the new workflow

## 2. Documentation and verification

- [x] 2.1 Update contributor documentation to use the new `hk` setup and manual lint commands
- [x] 2.2 Run the repository lint workflow, fix any migration fallout, and verify the new configuration works end to end
