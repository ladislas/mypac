---
description: "Analyze and plan work without implementing"
argument-hint: "[idea | issue/PR URL | PRD | todo ID | free text]"
---

Let's look at that.

Use this prompt for exploration, reframing, planning, and deciding the next workflow. Do not edit files, create commits, run mutating commands, post GitHub comments, or otherwise implement unless the user explicitly switches to execution.

Process:

1. Resolve the target from the provided argument, current conversation, linked issue/PR, PRD, todo, URL, or artifact. If the target is unclear, ask one concise clarifying question.
2. Summarize the goal, current context, assumptions, and known constraints.
3. Decide whether the work is:
   - simple and ready for implementation,
   - ambiguous and needs exploration,
   - issue-backed and needs grilling/documented decisions,
   - large enough for a PRD,
   - ready to break into implementation issues,
   - out of scope or not worth doing.
4. Route to existing workflows instead of duplicating them:
   - `/pac-explore` for open-ended discovery,
   - `/pac-grill-me` for conversational design stress-testing,
   - `/pac-grill-with-docs` for issue-backed refinement with durable notes,
   - `/pac-to-prd` for larger product/design artifacts,
   - `/pac-to-issues` for decomposing agreed plans,
   - `/pac-lwot` when the user wants implementation.
5. If the work is ready, produce a short implementation-ready brief: goal, files likely involved, risks, verification, and open questions.
6. Stop before implementation and ask what the user wants next.

Keep the response concise. Prefer questions and recommendations over speculative coding.

**Provided arguments**: $@
