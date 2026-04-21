## REMOVED Requirements

### Requirement: Repository defines a reusable shared OpenCode kit

**Reason**: OpenCode is no longer a supported runtime for this repository, so the repository should not present itself as an active shared OpenCode kit.
**Migration**: Use the repository as a Pi package and follow the Pi-first workflow documented in `README.md`.

### Requirement: Shared kit supports opt-in loading via OPENCODE_CONFIG_DIR

**Reason**: The repository is retiring OpenCode support rather than maintaining an opt-in compatibility loading path.
**Migration**: No direct OpenCode replacement is provided; use the Pi package-loading workflow instead.

### Requirement: Shared OpenCode assets use a canonical namespace with runtime-compatible bootstrap exceptions

**Reason**: The OpenCode shared-kit naming model is no longer part of the supported repository interface.
**Migration**: Preserve only Pi-native workflows and naming that remain part of the active setup.

### Requirement: Canonical identifiers are the source of truth where OpenCode supports them cleanly

**Reason**: These identifier rules exist only to govern the retired OpenCode runtime surface.
**Migration**: No OpenCode naming migration is required after retirement; keep active Pi assets aligned with Pi conventions instead.

### Requirement: Shared workflow references stay consistent with canonical command names

**Reason**: OpenCode command references are being removed from the supported workflow.
**Migration**: Keep remaining workflow references aligned with Pi-native prompts, skills, and README guidance.

### Requirement: Shared commands coexist cleanly with repository-local overlays

**Reason**: The repository is no longer maintaining OpenCode overlay behavior as a supported capability.
**Migration**: No replacement overlay model is required for retired OpenCode commands.

### Requirement: Bootstrap implementation remains intentionally small

**Reason**: This bootstrap requirement only exists for the retired OpenCode shared-kit architecture.
**Migration**: None.

### Requirement: Bootstrap favors minimal structural change

**Reason**: This requirement governed the earlier OpenCode bootstrap path and no longer applies once OpenCode support is retired.
**Migration**: None.
