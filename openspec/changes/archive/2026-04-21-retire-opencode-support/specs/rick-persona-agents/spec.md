## REMOVED Requirements

### Requirement: RickBuild agent exists as a primary agent

**Reason**: The repository is no longer shipping OpenCode primary agents as part of the supported runtime surface.
**Migration**: Preserve the persona content in a GitHub issue for possible future Pi-native persona work; no active agent replacement is required now.

### Requirement: RickPlan agent exists as a primary agent

**Reason**: The repository is retiring OpenCode-only agent assets instead of keeping dormant persona files.
**Migration**: Preserve the persona content in a GitHub issue for possible future Pi-native persona work; no active agent replacement is required now.

### Requirement: RickPlan SHALL NOT modify files

**Reason**: This tool-permission requirement only applies to the retired OpenCode `RickPlan` agent.
**Migration**: None until a future Pi-native persona mechanism is designed.

### Requirement: RickPlan bash access is restricted to exploration and scoped GitHub issue commands

**Reason**: This shell-access model only applies to the retired OpenCode `RickPlan` agent.
**Migration**: None until a future Pi-native persona mechanism is designed.

### Requirement: Rick persona agents receive explicit handoff framing on switch

**Reason**: Handoff behavior for OpenCode persona agents is no longer part of the supported runtime.
**Migration**: None until future persona support is revisited in Pi.

### Requirement: Rick persona agents are model-aware at runtime

**Reason**: This runtime-awareness behavior depends on persona agents that are being removed from the active repository surface.
**Migration**: None until future persona support is revisited in Pi.

### Requirement: Agent files are self-contained

**Reason**: The repository is removing the agent files rather than keeping them as inactive runtime assets.
**Migration**: Preserve the existing content in the future-work GitHub issue instead of keeping self-contained agent files in the repo.

### Requirement: Agents inherit the active model

**Reason**: This requirement only matters while the OpenCode persona agents are actively shipped.
**Migration**: None.
