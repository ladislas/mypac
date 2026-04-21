## REMOVED Requirements

### Requirement: Quick task capture creates a GitHub issue in the current repository

**Reason**: The repository does not currently provide a supported repo-local `/add-task` command in its active Pi prompts, skills, or extensions.

**Migration**: Remove this capability from the active spec surface. If lightweight GitHub issue capture is needed later, reintroduce it through a new change proposal with an implemented prompt, skill, or extension.

### Requirement: Created issues are labeled for future triage

**Reason**: The required issue-creation workflow is not currently implemented, so the labeling contract is unsupported.

**Migration**: Do not promise automatic `needs triage` labeling until an implemented issue-creation workflow exists.

### Requirement: Larger tasks can collect structured context before issue creation

**Reason**: The repository does not currently implement the guided issue-creation flow described by this requirement.

**Migration**: Reintroduce structured issue capture only together with an implemented supported command flow.

### Requirement: The command preserves a low-friction path for simple tasks

**Reason**: The repository does not currently implement the command that this behavior depends on.

**Migration**: Treat this as a future design concern, not an active repository requirement.

### Requirement: Issue creation failures are actionable

**Reason**: Without an implemented issue-creation command, there is no current supported failure-handling surface for this capability.

**Migration**: Define actionable failure behavior only when a supported GitHub task capture workflow is implemented.
