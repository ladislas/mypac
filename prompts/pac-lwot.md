---
description: "Start implementation from a note, issue, PR, todo, PRD, URL, or conversation context"
argument-hint: "[note | issue/PR URL | PRD | todo ID | free text]"
---

Let's work on that.

Use this prompt when the user wants execution from available context. The target may be conversation history, a GitHub issue or PR, a todo, a PRD, a URL, a note, or a concrete request.

If the user is still exploring, debating scope, asking whether something is worth doing, or asking for options, recommend `/pac-llat` instead of starting implementation.

Process:

1. Resolve the target. Prefer explicit arguments, then current conversation context. For GitHub issues/PRs, read the relevant GitHub context. For todos, read the todo before editing.
2. Check repository state and branch. Do not work directly on `main`; create or switch to a properly named branch when needed.
3. State the goal, assumptions, and any ambiguity. If intent or scope is unclear, ask before editing.
4. Give a short implementation plan and verification plan before making changes.
5. Load specialized skills only when relevant:
   - `skills/pac-tdd/SKILL.md` for behavior-changing implementation, bug fixes, or regression coverage.
   - `skills/pac-pi-prompt/SKILL.md` when creating or updating prompts.
   - `skills/pac-pi-extension/SKILL.md` when touching extension code.
   - `/pac-llat`, `/pac-explore`, `/pac-grill-with-docs`, `/pac-to-prd`, or `/pac-to-issues` when the request needs more planning instead of coding.
6. Implement the smallest slice that satisfies the request. Keep changes surgical and directly tied to the target. Avoid unrelated refactors.
7. Verify with the smallest relevant checks. Report what changed, what was verified, and any remaining follow-up.
8. For meaningful completed slices, create atomic commits according to `skills/pac-commit/SKILL.md` when asked or when the implementation workflow calls for it. If the work originated from a GitHub issue, include `closes #<issue-number>` in the resolving commit body. Do not guess issue numbers.

Use GitHub context and linked artifacts as supporting material, not permission to expand scope.

**Provided arguments**: $@
