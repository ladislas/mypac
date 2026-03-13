## 1. Command Definition

- [ ] 1.1 Add `.opencode/commands/add-task.md` with front matter and a workflow for creating GitHub issues from the current repository
- [ ] 1.2 Align the new command's structure and tone with existing repo-local commands such as `.opencode/commands/commit.md` and `.opencode/commands/merge.md`

## 2. GitHub Issue Creation Flow

- [ ] 2.1 Implement the fast path that creates an issue from a short `/add-task <description>` input
- [ ] 2.2 Add a label check that ensures `needs triage` exists, creating it when necessary before issue creation
- [ ] 2.3 Ensure every issue created by the command includes the `needs triage` label
- [ ] 2.4 Add clear failure handling for missing `gh` authentication, repository access, or issue creation errors

## 3. Guided Story Capture

- [ ] 3.1 Define a lightweight heuristic that distinguishes simple tasks from larger tasks or stories
- [ ] 3.2 Add a short follow-up question flow for larger work to collect context, desired outcome, and future notes
- [ ] 3.3 Generate a structured issue body for larger tasks while keeping simple-task issue bodies minimal

## 4. Verification

- [ ] 4.1 Verify the command against the current repository with a simple task example
- [ ] 4.2 Verify the command against the current repository with a larger-task example that triggers the guided flow
- [ ] 4.3 Confirm both created issues include the `needs triage` label and expected title/body formatting
