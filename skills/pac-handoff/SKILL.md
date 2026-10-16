---
name: pac-handoff
description: "Creates a concise handoff document for another Pi session or agent. Use when ending work, switching sessions, pausing multi-step work, or preparing context for a fresh agent."
license: MIT
compatibility: Pi coding agent
metadata:
  author: mypac
  stage: shared
---

# Create a handoff for the next session

Use this skill when the current work should be easy for a fresh Pi session or another agent to continue.

## Process

1. Identify the intended next-session focus.
   - If the user provided a focus, tailor the handoff to it.
   - If the focus is unclear, ask one concise clarifying question.
2. Choose a durable handoff file path outside the current workspace under `~/.pi/agent/handoffs/<timestamp>-<slug>.md`.
   - Use a UTC timestamp such as `YYYYMMDD-HHMMSS`.
   - Derive `<slug>` from the handoff title or next-session focus.
3. Write the complete, concise handoff document to that path.
4. Invoke the `read` tool on the completed file to verify its content and make its path visible in the transcript.
   - If the file is missing or unreadable, report the read-back failure; do not claim successful verification.
5. Return the completed file path and a short summary to the user, noting any read-back failure.

## Handoff content

Include only what the next session needs:

- Goal or next-session focus
- Current status
- Key decisions already made
- Durable artifacts to read next
- Suggested skills or prompts to load
- Immediate next actions
- Open questions or risks

Do **not** duplicate content already captured in durable artifacts. Reference issues, PRDs, ADRs, comments, commits, diffs, or file paths instead of re-summarizing them in full.

## Suggested format

```md
# Handoff: <short title>

## Focus
<what the next session should do>

## Status
<where things stand>

## Durable artifacts
- <issue/PR/comment/path/commit/diff reference>

## Suggested skills/prompts
- <skill or prompt, if useful>

## Next actions
1. <first action>
2. <second action>

## Open questions / risks
- <question or risk, if any>
```

Keep the document compact. Prefer pointers over prose when a durable artifact already contains the detail.
