## MODIFIED Requirements

### Requirement: Shared OpenCode assets use a canonical namespace with runtime-compatible bootstrap exceptions

The system SHALL define a canonical naming convention for shared OpenCode assets using a common `pac-` namespace prefix, while limiting bootstrap exceptions to asset types whose runtime-visible name is filename-bound and intentionally preserved for compatibility.

#### Scenario: Shared skill is uniquely identifiable

- **WHEN** a shared skill is added to the kit
- **THEN** its canonical identifier uses the shared namespace prefix and does not rely on punctuation outside kebab-case

#### Scenario: Shared command is uniquely identifiable

- **WHEN** a shared OpenSpec workflow command is defined in the kit
- **THEN** its filename-derived runtime command name uses the `pac-` namespace rather than a generic `opsx-` prefix

#### Scenario: Bootstrap agent remains clearly distinguishable

- **WHEN** the bootstrap preserves an existing shared primary agent whose runtime name is derived directly from the filename
- **THEN** that agent may keep its established runtime name and the exception is documented as a compatibility choice

### Requirement: Canonical identifiers are the source of truth where OpenCode supports them cleanly

The system SHALL treat canonical shared identifiers as the source of truth for shared skills and shared commands, while documenting compatibility-preserving exceptions only for bootstrap assets whose visible runtime identity intentionally remains filename-bound.

#### Scenario: Skill file and internal name use canonical namespace

- **WHEN** a shared skill is defined in the repository
- **THEN** its directory name and internal skill name use the canonical `pac-` namespace

#### Scenario: Shared command filename uses canonical namespace

- **WHEN** a shared OpenSpec workflow command is defined in the repository
- **THEN** its command filename and user-facing runtime name use the canonical `pac-` namespace

#### Scenario: User-facing label may remain concise

- **WHEN** OpenCode supports a separate user-facing label or description for a shared asset
- **THEN** that visible label may remain more concise than the canonical identifier without changing the underlying canonical name

#### Scenario: Remaining bootstrap exception is documented

- **WHEN** a shared bootstrap agent keeps an established runtime-visible name for compatibility
- **THEN** the repository documentation explains that exception and distinguishes it from shared commands that now use the canonical `pac-` namespace directly

## ADDED Requirements

### Requirement: Shared workflow references stay consistent with canonical command names

The system SHALL keep shared command instructions, shared skill prompts, and repository workflow documentation aligned with the canonical shared `/pac-*` command set.

#### Scenario: Shared command instructions use canonical names

- **WHEN** a reader opens a shared command definition or shared skill instruction
- **THEN** cross-references to the OpenSpec workflow point to the corresponding `/pac-*` command names

#### Scenario: Workflow playbooks use canonical names

- **WHEN** a reader follows local workflow documentation for the shared OpenCode kit or OpenSpec usage
- **THEN** the documented command examples use `/pac-*` consistently instead of stale `/opsx-*` references

### Requirement: Shared commands coexist cleanly with repository-local overlays

The system SHALL expose shared workflow commands under the `pac-` namespace so they remain distinguishable when the shared kit is loaded alongside repository-local `.opencode/commands` assets.

#### Scenario: Shared and local commands appear together without namespace collision

- **WHEN** `OPENCODE_CONFIG_DIR` loads the shared kit and a repository also defines local OpenCode commands
- **THEN** the resolved command set includes the shared `/pac-*` commands alongside the local commands without requiring shared generic `/opsx-*` names

#### Scenario: Repository can keep its own OpenSpec-flavored commands

- **WHEN** a repository defines its own OpenSpec-related command names for local workflow needs
- **THEN** the shared workflow remains separately accessible through the `pac-` command namespace
