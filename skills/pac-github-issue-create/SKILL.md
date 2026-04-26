---
name: pac-github-issue-create
description: "Create a GitHub issue in the current repository with gh. Use when the user wants to capture work as an issue from Pi or through the /ghi command."
---

# GitHub issue creation skill

Use this skill when the user wants to create a GitHub issue in the current repository.

## Goal

Turn the provided note into a useful GitHub issue with:

- a concise title
- a structured body
- a created issue URL returned to the user

## Workflow

1. Confirm you are in a git repository:

   ```bash
   git rev-parse --is-inside-work-tree
   ```

   If this fails, stop and explain that issue creation must run inside a git repository.

2. Confirm `gh` is available:

   ```bash
   gh --version
   ```

   If this fails, stop and explain that the GitHub CLI is required.

3. Resolve the current repository with GitHub CLI:

   ```bash
   gh repo view --json nameWithOwner --jq .nameWithOwner
   ```

   If this fails, stop and explain that `gh` must be authenticated and have access to the repository.

4. Use the provided note to draft the issue.

   - If the note already reads like a good issue title, you may reuse it.
   - Otherwise, derive a short imperative or descriptive title.
   - Ask at most one brief follow-up question only if the note is too ambiguous to create a useful issue.

5. Create a structured issue body with these sections:

   ```md
   ## Summary

   <short summary>

   ## Motivation

   <why this matters>

   ## Acceptance Criteria

   - [ ] <first concrete outcome>
   - [ ] <second concrete outcome>
   ```

   Keep the body proportional to the note. For a tiny note, stay concise.

6. Create the issue with `gh issue create` against the current repository.

   Prefer passing the repo explicitly:

   ```bash
   gh issue create --repo <owner/repo> --title "<title>" --body-file <temp-file>
   ```

   Use a temp file for the body when that is simpler than shell escaping.

7. Return the created issue URL to the user.

## Linking issues

Use this section only as skill-level guidance for the agent when a newly created issue should immediately be linked to existing issues because the user's note clearly implies that relationship. This does **not** define a separate interactive `/ghi link` command.

1. Resolve the relevant GitHub issue node IDs.

   For any issue you need to reference, including the newly created issue once you know its number, get its node ID first:

   ```bash
   gh issue view <number> --json id --jq .id
   ```

2. Create a parent / sub-issue relationship with `addSubIssue`.

   After creating the new issue, use GitHub GraphQL to attach it to an existing parent issue:

   ```bash
   gh api graphql \
     -f query='mutation($issueId:ID!, $subIssueId:ID!) { addSubIssue(input:{issueId:$issueId, subIssueId:$subIssueId}) { issue { number } subIssue { number } } }' \
     -f issueId=<parent-issue-node-id> \
     -f subIssueId=<new-issue-node-id>
   ```

   - `issueId` is the parent issue.
   - `subIssueId` is the child issue.

3. Create dependency relationships with `addBlockedBy`.

   Use `addBlockedBy` when the new issue depends on another issue:

   ```bash
   gh api graphql \
     -f query='mutation($issueId:ID!, $blockingIssueId:ID!) { addBlockedBy(input:{issueId:$issueId, blockingIssueId:$blockingIssueId}) { issue { number } blockedByEdge { node { number } } } }' \
     -f issueId=<blocked-issue-node-id> \
     -f blockingIssueId=<blocking-issue-node-id>
   ```

   Direction matters:

   - For “new issue is **blocked by** #42”:
     - `issueId` = new issue
     - `blockingIssueId` = #42
   - For “new issue **blocks** #42”:
     - `issueId` = #42
     - `blockingIssueId` = new issue

4. Keep linking scoped to the issue-creation request.

   - Only add relationships that are clearly implied by the user's note.
   - Do not broaden this into general issue management.
   - Surface GraphQL errors clearly if linking fails.

## Constraints

- This skill is only for creating an issue, not listing, opening, closing, or reviewing issues.
- Do not broaden scope beyond the provided note.
- Surface `gh` errors clearly instead of paraphrasing them away.
- If creation succeeds, include the final issue URL in the response.
