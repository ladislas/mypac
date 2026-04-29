---
name: pac-grill-with-docs
description: "Grill issue-backed work against the codebase and project language, then persist durable outcomes to GitHub issue updates, ADR comments, PRD comments, and sparing CONTEXT.md edits. Use when working from a GitHub issue/PR or when the user wants grilling plus durable notes."
license: MIT
compatibility: Pi coding agent
metadata:
  author: mypac
  stage: shared
---

# Grill with GitHub-backed docs

Interview me relentlessly about the plan until we reach shared understanding. Walk each design branch one-by-one. For each question, give your recommended answer.

Ask questions one at a time. Wait for the answer before continuing.

If the codebase, issue history, or current docs can answer a question, explore them instead of asking.

## Default flow

1. Resolve the target from the explicit issue/PR URL, todo, or current conversation.
2. Read the issue title, body, status, and most relevant comments before questioning.
3. Pick grilling depth from scope:
   - tiny clear issue or one-line bug -> ask only a few confirming questions
   - fuzzy, strategic, or multi-step work -> grill more deeply
4. End with a concise recommended next step: implement, rewrite issue scope, add PRD, add ADR, update `CONTEXT.md`, or stop.

## GitHub-first persistence

GitHub issues are the primary scratchpad for exploration, scope refinement, and decision-making.

Prefer storing planning outputs back into the issue over creating repo-local planning docs.

### Refine issue scope

If grilling shows the issue title/body is unclear or wrong, offer to rewrite it so the new scope is crisp.

- Preserve freeform notes when possible.
- It is safe to manage small reserved sections in the body such as `## Decisions` and `## PRDs`.
- Rely on GitHub edit history instead of duplicating old wording in comments unless the user asks.

### ADR comments

Do **not** create repo-local `docs/adr/` files for this workflow.

Offer an ADR only when all three are true:

1. **Hard to reverse** — changing course later is meaningfully costly
2. **Surprising without context** — a future reader would wonder why this path was chosen
3. **Real trade-off** — genuine alternatives existed and this choice won for specific reasons

When the user wants an ADR:

- create **one GitHub comment per decision**
- use [`ADR-FORMAT.md`](./ADR-FORMAT.md)
- prepend hidden marker `<!-- pac:adr -->`
- add issue label `adr`
- update or create `## Decisions` in the issue body with a link to the ADR comment

If several important decisions exist, create several ADR comments. Do not keep one mega-comment.

### PRD comments

When the work needs more planning than immediate implementation, offer a PRD comment instead of code.

- use [`PRD-FORMAT.md`](./PRD-FORMAT.md) for the PRD body
- create one GitHub comment per PRD iteration
- prepend hidden marker `<!-- pac:prd -->`
- add or keep issue label `prd` when that label already exists
- never create missing labels automatically
- update or create `## PRDs` in the issue body with a link to the PRD comment

### `CONTEXT.md`

Keep one repo-root `CONTEXT.md` for stable reusable project language, invariants, and conventions.

- Do not update it for every issue.
- Wait until the end of the session.
- Suggest an update only when the discussion produced facts worth preloading in future sessions.
- Propose the exact additions first. Write only after user confirmation.
- Use [`CONTEXT-FORMAT.md`](./CONTEXT-FORMAT.md).

## Questioning style

- Ask one question at a time.
- Give a recommended answer with each question.
- Challenge fuzzy or overloaded terms.
- Cross-check claims against the codebase and issue history.
- Use concrete scenarios to test boundaries.
- Stop when uncertainty is low enough to choose the next action. Do not ask 100 questions for a tiny clear fix.

## Before writing back

- If GitHub access fails, say so plainly and ask the user to paste the missing context.
- Read the latest issue body/comments before editing so you do not stomp newer context.
- Keep repo changes minimal and tied to settled outcomes only.
