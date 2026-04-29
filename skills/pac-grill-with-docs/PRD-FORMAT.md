# PRD Content Format

Use this shared format for PRD **content**.

Keep publication wrappers outside this file:

- local draft metadata
- `<!-- pac:prd -->` comment markers
- GitHub labels
- issue-body `## PRDs` link maintenance

`pac-grill-with-docs` and `pac-to-prd` should both reuse this body format.

## Template

```md
# PRD — {Short title}

## Context Links

- Main issue: #{number} — {title}
- Related issue: #{number} — {title}
- Related PR: #{number} — {title}
- Draft source: {local draft path or URL}

## Problem Statement

The problem from the user's or team's perspective.

## Solution

The proposed solution from the user's or team's perspective.

## User Stories

1. As a/an {actor}, I want {feature}, so that {benefit}

## Implementation Decisions

- Major modules to build or modify
- Important interface, schema, or workflow decisions
- Architectural constraints worth preserving

## Testing Decisions

- What makes a good test for this work
- Which modules or behaviors should be tested
- Relevant prior art in the codebase

## Out of Scope

- Explicit non-goals

## Further Notes

Any additional context that will help the next implementation session.
```

## Rules

- Keep the structure close to upstream [`mattpocock/skills/to-prd`](https://github.com/mattpocock/skills/tree/main/to-prd), with light wording adapted to `mypac`.
- Always include a visible `## Context Links` section.
- Include only the links that actually help; remove placeholder bullets.
- If no useful context links exist, keep the section and write `- None`.
- Make the user-story list extensive enough to cover the important workflow edges.
- Do not include file paths or code snippets in `Implementation Decisions`.
- Keep publication-specific instructions out of the PRD body.
