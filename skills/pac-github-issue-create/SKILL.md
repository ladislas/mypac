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

## Constraints

- This skill is only for creating an issue, not listing, opening, closing, or reviewing issues.
- Do not broaden scope beyond the provided note.
- Surface `gh` errors clearly instead of paraphrasing them away.
- If creation succeeds, include the final issue URL in the response.
