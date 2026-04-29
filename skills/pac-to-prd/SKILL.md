---
name: pac-to-prd
description: "Synthesize current context into a structured PRD draft or publishable PRD artifact using a shared template. Use when the user wants a PRD from conversation context, a GitHub issue, or a saved draft path."
license: MIT
compatibility: Pi coding agent
metadata:
  author: mypac
  stage: shared
---

# Turn context into a PRD

Use this skill when the user wants a PRD from the current conversation, an issue, or an existing local PRD draft.

Do **not** run a broad discovery interview. Synthesize what is already known from the conversation, issue context, and codebase.

If a critical ambiguity blocks a useful draft, ask at most one narrow follow-up question.

## Inputs

The input may be:

- current conversation context
- a GitHub issue or PR URL
- a local draft path under `~/.pi/agent/prds/`
- short free text that points at the work

If the input is a local draft path, treat that draft as the source of truth. Do **not** resynthesise the PRD from current chat context unless the user explicitly asks you to rewrite it.

## Publication modes

Support exactly these modes:

- `draft-only`
- `comment-on-issue`
- `create-issue`

Default to `draft-only` unless the user clearly asks for GitHub publication.

## Process

1. Resolve the source material.

   - If given an issue or PR URL, read the minimum relevant context first.
   - If given a local draft path, read the file and use it as the authoritative source.
   - Otherwise, use the current conversation plus focused repo exploration.
   - If the user wants `comment-on-issue` and no target issue is obvious, ask one narrow follow-up question.

2. Explore the repo enough to sketch the likely module shape and testing scope.

   **Skip this step when the input is a local draft path.** The draft is already the source of truth; do not derive a new module shape from the repo that could silently override it.

   - Actively look for opportunities to propose deep, testable modules instead of shallow glue.
   - Keep this sketch concrete enough to review, but do not drop into file-by-file implementation planning.

3. Show one review checkpoint **before producing the draft or publishing to GitHub**.

   Present:

   - proposed PRD title
   - proposed module shape
   - proposed testing scope
   - intended publication mode
   - main and related context links you plan to include

   Allow one review pass to correct the framing. Do not turn this into an open-ended grilling session.

4. Build the PRD body using [`../pac-grill-with-docs/PRD-FORMAT.md`](../pac-grill-with-docs/PRD-FORMAT.md).

   - Reuse that shared format for PRD **content**.
   - Keep publication wrappers out of the shared body.
   - Do not include file paths or code snippets.

5. Handle output based on the publication mode.

### `draft-only`

Write a local draft outside the repo under:

```text
~/.pi/agent/prds/<session-id>/<timestamp>-<slug>.md
```

Derive `<session-id>` from the current Pi session identifier, following the same convention used by the slidedeck extension (`extensions/slidedeck/`). `<timestamp>` is `YYYYMMDDHHmmss` in UTC. `<slug>` is a lowercase, hyphen-separated summary of the PRD title (e.g. `pac-to-prd-draft-workflow`).

Store minimal human-editable metadata as YAML frontmatter:

```yaml
---
title: PRD — {short title}
source: {conversation | issue URL | draft path | free text summary}
publish_mode: draft-only
main_issue: {optional main issue number or URL}
related_issues:
  - {optional related issue number or URL}
---
```

- `main_issue` is optional.
- `related_issues` is optional.
- Omit optional fields when they do not apply.

Then place the shared PRD body below the frontmatter.

Return the saved path to the user. Treat this draft file as a first-class artifact for later publish/update runs.

### `comment-on-issue`

Before any GitHub write, require an explicit final confirmation from the user.

When publishing from a local draft file:

- use the draft file as the source of truth
- do not silently resynthesise the PRD
- strip local draft frontmatter from the published comment body

Then:

- prepend `<!-- pac:prd -->`
- create a **new** PRD iteration comment each run
- do **not** edit the prior PRD comment in place
- update or create `## PRDs` in the issue body with a link to the new comment
- add or keep the `prd` label only when that label already exists in the target repository
- never create missing labels automatically

### `create-issue`

Before any GitHub write, require an explicit final confirmation from the user.

When publishing from a local draft file:

- use the draft file as the source of truth
- do not silently resynthesise the PRD

Then:

- create a new GitHub issue whose title is a concise version of the PRD title and whose **body is the PRD itself**
- do **not** create a duplicate PRD comment
- add `needs triage` and `prd` only when those labels already exist in the target repository
- never create missing labels automatically

## GitHub safety rules

- Surface `gh` failures plainly.
- If labels are missing, skip them without turning that into a blocker.
- Keep GitHub publication explicit and non-invasive.
- Do not reference external setup skills.

## When to stop and redirect

- If the user actually needs discovery rather than synthesis, suggest `pac-grill-with-docs` or `/pac-explore`.
- If the user wants implementation, keep the PRD concise and then hand off to the planning or implementation workflow.
