---
description: Quickly capture a GitHub issue in the current repository for future triage
---

Capture a task as a GitHub issue in the current repository. Every issue gets the `needs triage` label.

## Current state

!`gh auth status 2>&1`

!`gh label list --search "needs triage" --json name 2>&1`

## Input

Task description (if any): $ARGUMENTS

## Steps

1. Check prerequisites
   - If `gh auth status` failed because GitHub CLI is unauthenticated, stop and tell the user: "GitHub CLI is not authenticated. Run `gh auth login` first."
   - If `gh auth status` failed because the current agent is not allowed to run that command or another required GitHub operation, stop and tell the user that the current agent policy blocks the needed GitHub action and they should switch agents.
   - If the label list command failed (e.g. repo not found), stop and tell the user why issue creation cannot proceed.

2. Ensure the `needs triage` label exists
   - If the label list output is empty (`[]`), create it:

     ```
     gh label create "needs triage" --description "Issue needs review and prioritization" --color "FBCA04"
     ```

   - If it already exists, continue.

3. Get task input
   - If `$ARGUMENTS` is empty, use the **AskUserQuestion tool** (open-ended, no preset options) to ask:
     > "What task do you want to capture?"
   - Use the response as the task description going forward.

4. Classify the task
   Decide whether this is a **simple task** or a **larger task / story**:

   - **Simple task** — the description is a short, single-purpose statement (e.g. "fix typo in README", "update node version", "add .gitignore entry for .env")
   - **Larger task / story** — the description mentions multiple parts, a feature, a workflow change, contains words like "story", "epic", "feature", "refactor", or is clearly multi-step work

5. Simple task path
   If the task is simple:

   - Use the description as the issue title
   - Create the issue with an empty body:

     ```
     gh issue create --title "<title>" --label "needs triage" --body ""
     ```

   - Report the created issue URL to the user

6. Larger task path
   If the task is larger:

   - Use the **AskUserQuestion tool** to ask the following (open-ended, no preset options):
     > "This looks like a larger piece of work. To create a useful issue, tell me a bit more:
     > 1. Why is this needed? (motivation / problem)
     > 2. What does done look like? (desired outcome)
     > 3. Any extra notes for your future self?"
   - From the user's answers, draft:

     - A concise issue **title** derived from the original description
     - A structured issue **body** using this format:

     ```
     ## Context

     <motivation / problem from user's answer>

     ## Desired Outcome

     <what done looks like from user's answer>

     ## Notes

     <any extra notes, or "None." if nothing provided>
     ```

   - Create the issue:

     ```
     gh issue create --title "<title>" --label "needs triage" --body "<body>"
     ```

   - Report the created issue URL to the user

7. Confirm result
   - Show the issue number, title, and URL
   - If issue creation failed at any point, show the exact error from `gh` or the permission system and do not claim success

## Constraints

- Every issue MUST have the `needs triage` label — never skip it
- Never create an issue without confirming the title with the user first for larger tasks
- Keep simple-task creation to a single step — do not ask follow-up questions
- If `gh` or the agent permission system fails at any step, stop and report the error clearly
- If a required GitHub operation is blocked by agent policy, report that clearly instead of saying `gh` is unavailable
- Task description hint (if any): $ARGUMENTS
