## ADDED Requirements

### Requirement: Pi is the sole supported local interface

The repository SHALL define Pi as the only supported day-to-day interface for local use.

#### Scenario: README points to the Pi launcher

- **WHEN** a contributor checks how to work in this repository
- **THEN** the documented launcher is `mise run pi`

#### Scenario: OpenCode is not presented as a supported interface

- **WHEN** a contributor checks active setup and workflow guidance
- **THEN** they are not directed to use OpenCode as a supported local interface

### Requirement: README is the primary source of truth for active setup

The repository SHALL keep the active setup and interface guidance concise and discoverable in `README.md`.

#### Scenario: Pi setup is discoverable from the repository landing page

- **WHEN** a reader opens `README.md`
- **THEN** they can find the supported Pi usage and package-loading guidance without needing a separate setup document

#### Scenario: Retired documents are not promoted as active setup

- **WHEN** the repository retains historical documentation for reference
- **THEN** `README.md` does not route readers to those documents as the active interface or setup source of truth

### Requirement: Pi package metadata matches the supported repository layout

The repository SHALL keep its Pi package metadata aligned with the directories and assets that actually exist in the Pi-only setup.

#### Scenario: Declared Pi resource directories exist

- **WHEN** `package.json` declares Pi resource directories
- **THEN** each referenced directory exists in the repository and is part of the supported Pi workflow

#### Scenario: Retired OpenCode integration does not linger in the active package surface

- **WHEN** OpenCode support is retired from the repository
- **THEN** the active package metadata does not imply ongoing OpenCode runtime integration
