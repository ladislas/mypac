# local-opencode-mise-workflow Specification

## Purpose

Define the supported local workflow for running OpenCode against this shared kit with `mise`, including the repository-root config target and the rejected `.opencode/` symlink alternative.

## Requirements

### Requirement: Local shared-kit workflow uses `mise` tasks

The repository SHALL provide a supported local workflow for running OpenCode against this shared kit through `mise` tasks that target the repository root as `OPENCODE_CONFIG_DIR`.

#### Scenario: Primary local launcher is available through mise

- **WHEN** a contributor follows the documented local workflow for this repository
- **THEN** they are directed to use `mise run opencode` as the supported way to launch OpenCode with this shared kit loaded

#### Scenario: Mise launcher targets repository root

- **WHEN** the `mise run opencode` task launches OpenCode
- **THEN** it sets `OPENCODE_CONFIG_DIR` to the repository root rather than to `.opencode/`

### Requirement: Local workflow documentation stays aligned with the supported launcher

The repository SHALL document the `mise`-based launcher workflow consistently and SHALL not describe the `.opencode/` symlink approach as a supported local setup.

#### Scenario: Supported local workflow is documented consistently

- **WHEN** a reader checks repository documentation for how to run OpenCode locally with the shared kit
- **THEN** the documented day-to-day workflow points to the `mise run` launcher rather than to manual `.opencode/` path management

#### Scenario: Symlink alternative is treated as rejected

- **WHEN** the repository discusses alternative local setup approaches for the shared kit move
- **THEN** any `.opencode/` symlink approach is identified as an evaluated but rejected alternative instead of a supported option
