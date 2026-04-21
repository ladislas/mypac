## MODIFIED Requirements

### Requirement: Repository supports scoped Markdown lint overrides

The repository SHALL support a root Markdown lint configuration and a scoped override for `openspec/` files.

#### Scenario: OpenSpec file starts without a top-level heading

- **WHEN** a contributor lints a Markdown file inside `openspec/` that does not begin with a top-level heading
- **THEN** the file is evaluated with the `openspec/` override configuration
- **AND** the `MD041` rule does not fail for that file
