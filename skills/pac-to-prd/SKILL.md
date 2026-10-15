---
name: pac-to-prd
disable-model-invocation: true
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

If the input is a local draft path or an already approved draft, treat that draft as the source of truth. Do **not** resynthesise the PRD from current chat context unless the user explicitly asks you to rewrite it.

## Publication modes

Support exactly these modes:

- `draft-only`
- `comment-on-issue`
- `create-issue`

Default to `draft-only` unless the user clearly asks for GitHub publication. Honor explicit draft-only requests even when broader session authorization exists.

Reuse explicit session authorization that covers the requested publication; do not ask for it again. AFK describes implementation readiness, not publication permission. Repository restrictions still apply.

## Process

1. Resolve the source material.

   - If given an issue or PR URL, read the minimum relevant context first.
   - If given a local draft path, read the file; if the approved draft is already in context, reuse it. Use that draft as the authoritative source.
   - Otherwise, use the current conversation plus focused repo exploration.
   - If the user wants `comment-on-issue` and no target issue is obvious, ask one narrow follow-up question.

2. Explore the repo enough to sketch the likely module shape and testing scope.

   **Skip this step when publishing an existing source or approved draft.** The draft is already the source of truth; do not derive a new module shape from the repo that could silently override it.

   - Actively look for opportunities to propose deep, testable modules instead of shallow glue.
   - Keep this sketch concrete enough to review, but do not drop into file-by-file implementation planning.

3. Build the complete reviewable PRD body using [`../pac-grill-with-docs/PRD-FORMAT.md`](../pac-grill-with-docs/PRD-FORMAT.md), or retain the existing source or approved draft.

   - Use available context and reasonable implementation judgment; do not require routine approval of framing before drafting. Ask narrowly only when unresolved framing prevents a useful draft.
   - Reuse that shared format for PRD **content**.
   - Keep publication wrappers out of the shared body.
   - Do not include file paths or code snippets.

4. Present the complete draft, not just an outline, with the intended publication mode and any publication-specific title or wrapper. Its title, module shape, testing scope, and context links must be reviewable together.

   - For `draft-only`, save and return the draft for review; do not require approval to produce it, and do not publish it.
   - For GitHub publication, if authorization is missing, use this completed draft as the single normal approval checkpoint: ask for approval and authorization to publish to the intended destination together.
   - If explicit authorization already covers this publication, proceed without redundant confirmation unless the user requested review before publication. Do not reopen approval of an unchanged approved draft.
   - Incorporate requested framing corrections into this draft; ask narrowly if a correction leaves a blocking ambiguity. Do not restart a routine pre-draft gate or silently rewrite an approved draft.

5. Handle output based on the publication mode, preserving the reviewed draft's content through publication.

### `draft-only`

Write a local draft outside the repo under:

```text
~/.pi/agent/prds/<timestamp>-<slug>.md
```

Use a UTC timestamp such as `YYYYMMDD-HHMMSS`. Derive `<slug>` from the PRD title as a lowercase, hyphen-separated summary (e.g. `pac-to-prd-draft-workflow`).

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

Before any GitHub write, apply the authorization checkpoint in step 4; require confirmation only where authorization is missing.

When publishing from a local draft file:

- use the draft file as the source of truth
- do not silently resynthesise the PRD
- strip local draft frontmatter from the published comment body

Then:

- prepend `<!-- pac:prd -->`
- create a **new** PRD iteration comment each run
- do **not** edit the prior PRD comment in place
- update or create `## PRDs` in the issue body with a link to the new comment
- add or keep the `pac:prd` label only when that label already exists in the target repository
- never create missing labels automatically

### `create-issue`

Before publishing, derive one readiness determination from the PRD content: unresolved human decisions → 🟡 Human decisions required; no unresolved human decisions blocking implementation → 🟢 Ready for implementation. Do not assume a PRD is ready just because it is published. State the concrete outstanding decisions when 🟡, or None when 🟢. Use this same determination for the `pac:ready_for_agent` label.

Prepend the following short orientation layer to the GitHub issue body only, before the complete PRD. The published PRD remains authoritative for implementation. Do not add the summary to local drafts, `comment-on-issue` output, or the shared PRD content format. Do not add requirements absent from the PRD or shorten its constraints, investigation requirements, guardrails, dependencies, or acceptance criteria. Generate no bottom `TL;DR` when the Human summary is present:

```md
## Human summary

**Status:** <🟢 Ready for implementation / 🟡 Human decisions required, per PRD readiness>\
**Goal:** <intended outcome>\
**Why:** <reason the work matters>\
**Proposed change:** <short description of the proposed solution>\
**Human decisions:** <None / concrete unresolved decisions>\
**Scope:** <concise boundary of the work>
```

Before any GitHub write, apply the authorization checkpoint in step 4; require confirmation only where authorization is missing.

When publishing from a local draft file:

- use the draft file as the source of truth
- do not silently resynthesise the PRD

Then:

- create a new GitHub issue whose title is a concise, scannable version of the PRD title and whose **body is the PRD itself**
  - derive the issue title from the PRD title, but do not mirror it mechanically when a shorter title is clearer
  - prefer a short imperative or descriptive title that names the concrete work, such as `Improve pac-to-prd issue titles`
  - strip PRD/publication wrappers and redundant framing such as `PRD —`, `Create issue for`, or broad context already obvious from the repository
  - preserve the specific subject so issue lists remain understandable without opening the issue
  - avoid conventional-commit prefixes like `feat:` unless the user explicitly supplied that style
- do **not** create a duplicate PRD comment
- add `pac:ready_for_agent` only for 🟢 Ready for implementation, and only if that label already exists in the target repository; 🟡 Human decisions required must never receive `pac:ready_for_agent`
- add `pac:prd` only if that label already exists in the target repository
- never create missing labels automatically

## GitHub safety rules

- Surface `gh` failures plainly.
- If expected pac workflow labels are missing, warn clearly, skip them without turning that into a blocker, and tell the user to run the repo-local `/pac-setup-workflows` command.
- Keep GitHub publication explicit and non-invasive.
- Do not reference external setup skills or ad hoc setup mechanisms; `/pac-setup-workflows` is the canonical pac label setup command.

## When to stop and redirect

- If the user actually needs discovery rather than synthesis, suggest `pac-grill-with-docs` or `/pac-explore`.
- If the user wants implementation, keep the PRD concise and then hand off to the planning or implementation workflow.
