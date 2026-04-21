# content-precommit-validation Specification

## Purpose

Validate repository YAML and Markdown content during pre-commit so invalid or non-compliant files are rejected before commit.

## Requirements

### Requirement: Repository validates YAML before commit

The repository SHALL define a versioned `hk` hook configuration that validates YAML files with `yamllint` before a commit is created.

#### Scenario: Commit includes valid YAML changes

- **WHEN** a contributor runs a commit after installing the repository's `hk` hooks
- **THEN** YAML validation runs automatically against matching YAML files
- **AND** the commit is allowed to proceed if all YAML files satisfy the configured `yamllint` rules

#### Scenario: Commit includes invalid YAML changes

- **WHEN** a contributor runs a commit that includes an invalid or non-compliant `.yaml` or `.yml` file
- **THEN** the `hk` validation fails before the commit is created
- **AND** the failure output identifies the file so the contributor can fix it

### Requirement: YAML validation covers repository YAML file extensions

The repository SHALL configure YAML validation for both `.yaml` and `.yml` files managed in the repository.

#### Scenario: Repository uses either YAML extension

- **WHEN** a contributor stages changes to files ending in `.yaml` or `.yml`
- **THEN** those files are included in YAML validation by the pre-commit workflow

### Requirement: Repository lints Markdown before commit

The repository SHALL define a versioned `hk` hook configuration that lints repository Markdown files before a commit is created.

#### Scenario: Commit includes valid Markdown changes

- **WHEN** a contributor runs a commit after installing the repository's `hk` hooks
- **THEN** Markdown linting runs automatically against matching Markdown files
- **AND** the commit is allowed to proceed if the Markdown files satisfy the configured rules

#### Scenario: Commit includes Markdown lint violations

- **WHEN** a contributor runs a commit that includes a Markdown file that violates the configured lint rules
- **THEN** the `hk` validation fails before the commit is created
- **AND** the failure output identifies the file and lint rule so the contributor can fix it

### Requirement: Repository supports scoped Markdown lint overrides

The repository SHALL support a root Markdown lint configuration and a scoped override for `openspec/` files.

#### Scenario: OpenSpec file starts without a top-level heading

- **WHEN** a contributor lints a Markdown file inside `openspec/` that does not begin with a top-level heading
- **THEN** the file is evaluated with the `openspec/` override configuration
- **AND** the `MD041` rule does not fail for that file

### Requirement: Repository documents tool bootstrap and hook activation

The repository SHALL provide enough contributor guidance to install `mise`, install repository tools, and activate the configured `hk` hook locally.

#### Scenario: Contributor sets up hooks on a fresh clone

- **WHEN** a contributor follows the repository guidance after cloning the repo
- **THEN** they can install the repository-managed `hk` tool and hook configuration without needing to inspect git internals or manage Python, Node, or Pkl manually
