---
name: pac-to-issues
description: "Break a plan, PRD, or discussion into independently-grabbable GitHub issues using tracer-bullet vertical slices. Use when the user wants to convert a plan into issues, decompose a PRD into tickets, or create a set of linked implementation issues with explicit dependencies."
license: MIT
compatibility: Git repository; gh CLI required.
metadata:
  author: mypac
  stage: shared
---

# pac-to-issues

Break a plan into independently-grabbable GitHub issues using vertical slices (tracer bullets).

## Process

### 1. Gather context

Work from whatever is already in the conversation. If the user passes a GitHub issue number or URL, fetch it with:

```bash
gh issue view <number> --repo <owner/repo> --comments
```

Note the issue number — it becomes the parent for all created sub-issues.

If the input is a free-form plan or PRD with no parent issue, skip parent wiring steps.

### 2. Explore the codebase (optional)

If you have not already explored the relevant areas of the codebase, do so to understand the current state before slicing.

### 3. Draft vertical slices

Break the plan into **tracer bullet** issues. Each slice is a thin vertical cut through ALL relevant layers end-to-end, not a horizontal layer (e.g. not "write all the tests" or "update all the schemas").

Classify each slice as **HITL** or **AFK**:

- **HITL** (Human In The Loop): requires a human decision, design review, or approval before work can proceed or be merged.
- **AFK** (Away From Keyboard): can be implemented and merged autonomously without human interaction.

Prefer AFK over HITL where possible.

<vertical-slice-rules>
- Each slice delivers a narrow but complete path through every relevant layer
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
- Do not create horizontal slices (one layer at a time)
</vertical-slice-rules>

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice, show:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: which other slices (if any) must complete first
- **Summary**: one sentence describing the end-to-end behavior

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split?
- Are the HITL / AFK classifications correct?

Iterate until the user approves the breakdown.

### 5. Create the GitHub issues

Create issues in **dependency order** — blockers first — so real issue numbers are available when writing `## Blocked by` in dependent issues.

For each approved slice:

#### 5a. Create the issue

```bash
gh issue create \
  --repo <owner/repo> \
  --title "<title>" \
  --body-file <temp-file>
```

Use the issue body template below.

Apply the `hitl` or `afk` label only if it already exists in the repository. Create the issue first, then add the label conditionally:

```bash
issue_url=$(gh issue create \
  --repo <owner/repo> \
  --title "<title>" \
  --body-file <temp-file>)

issue_number=${issue_url##*/}
label_name="hitl"   # or "afk"

if gh label list --repo <owner/repo> --json name --jq '.[].name' | grep -Fxq "$label_name"; then
  gh issue edit "$issue_number" --repo <owner/repo> --add-label "$label_name"
else
  echo "Warning: label $label_name does not exist in <owner/repo>; skipping label"
fi
```

If the label does not exist, warn the user and skip it — do not fail the run.

#### 5b. Wire GraphQL relationships

After creating each issue, resolve its node ID:

```bash
gh issue view <number> --repo <owner/repo> --json id --jq .id
```

**Attach to parent** (if a parent issue exists):

```bash
gh api graphql \
  -f query='mutation($issueId:ID!, $subIssueId:ID!) {
    addSubIssue(input:{issueId:$issueId, subIssueId:$subIssueId}) {
      issue { number }
      subIssue { number }
    }
  }' \
  -f issueId=<parent-node-id> \
  -f subIssueId=<new-issue-node-id>
```

**Wire blockers** (for each declared blocker):

```bash
gh api graphql \
  -f query='mutation($issueId:ID!, $blockingIssueId:ID!) {
    addBlockedBy(input:{issueId:$issueId, blockingIssueId:$blockingIssueId}) {
      issue { number }
      blockedByEdge { node { number } }
    }
  }' \
  -f issueId=<new-issue-node-id> \
  -f blockingIssueId=<blocker-node-id>
```

Surface GraphQL errors clearly. Do not abort the run on failure — the text body is the reliable record.

### 6. Update the parent issue body

After all issues are created, append or update a `## Tasks` section in the parent issue body:

```md
## Tasks

- [ ] #<number> — <title>
- [ ] #<number> — <title>
```

Read the current body first to avoid stomping existing content. If a `## Tasks` section already exists, update it in place.

If there is no parent issue, skip this step.

## Issue body template

```md
## Summary

<concise description of this vertical slice — end-to-end behavior, not layer-by-layer implementation>

## Motivation

<one or two sentences on why this slice matters; may point back to the parent issue>

## Acceptance Criteria

- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>

## Type

HITL / AFK — <one sentence explaining why>

## Parent

#<parent-issue-number>

(Omit this section if there is no parent issue.)

## Blocked by

- #<issue-number> — <title>

Or: None — can start immediately.
```

## Constraints

- Create issues in dependency order (blockers first) so issue numbers are real when referenced.
- Do not close or modify the parent issue beyond adding `## Tasks`.
- Surface `gh` and GraphQL errors clearly instead of paraphrasing them away.
- If a `hitl` or `afk` label does not exist in the repository, warn and skip — do not fail the run.
- Use a temp file for issue bodies to avoid shell-escaping issues.
