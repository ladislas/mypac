---
description: "Turn a note, GitHub issue or PR, todo, or URL into a concrete plan and next steps"
argument-hint: "[text | GitHub issue/PR | todo ID | URL]"
---

Let's work on that.

Default to planning before implementation. Unless the task is truly straightforward and clearly ready to execute, explain the plan first and ask the user for confirmation before making changes. If the user may be discussing, exploring, or clarifying rather than asking for immediate implementation, lean on the side of caution and confirm before starting work.

Use the optional argument after `/pac-lwot` as the thing we should work from. It may be:

- a free-form description of the work
- a GitHub issue or PR URL
- a todo ID (e.g. `TODO-abc123`)
- another URL
- nothing, in which case infer from the conversation and ask only if unclear

**Input**: Optional context for the work: free text, GitHub issue/PR, todo ID, or another URL.

## Behavior

1. **Resolve the target**
   - If an argument is provided, use it.
   - If no argument is provided, infer what "that" refers to from the conversation.
   - If it is still unclear, ask a concise clarifying question before proceeding.

2. **Check branch safety**
   - Check the current git branch and note whether it is a protected/default branch (`main` or equivalent).
   - This is a read-only check only — do not create or switch branches yet.
   - If already on a non-protected feature branch, note that and continue.

3. **Gather the minimum context needed**
   - **Free text**: restate the goal in your own words and inspect the repository as needed.
   - **GitHub issue or PR**: use the `gh` CLI (or the URL directly) to read the title, body, status, and the most relevant comments or review notes.
   - **Todo ID**: read the todo with the `todo` tool (`action: get, id: <id>`) to retrieve its title, body, and status.
   - **Other URL**: fetch or read the page or resource and extract only the parts needed to do the work.
   - If a URL cannot be accessed because of auth, networking, or unsupported content, say so plainly and ask the user to paste the relevant context.

4. **Frame the work before changing code**
   - State your assumptions.
   - Define the smallest useful outcome.
   - Give a short plan before starting work, especially for anything non-trivial.
   - Unless the task is truly straightforward and the user's intent to implement is explicit, ask for confirmation before making changes.

5. **Choose the right path**
   - For very small, clear, implementation-ready work, proceed directly.
   - For anything that may still be under discussion, present the plan and ask whether to proceed.
   - For meaningful multi-step work, propose using OpenSpec (`/pac-propose` then `/pac-apply`) before implementation.
   - If the input is exploratory rather than actionable, suggest `/pac-explore`.

6. **Do the work**
   - Only start implementation once you have either user confirmation or a truly straightforward request that is clearly asking for execution now.
   - If Step 2 flagged a protected branch, create and switch to a properly named branch now, before touching any files. Use the repository naming convention (`<firstname>/<type>/<topic-more_info>`, where type is one of `feature`, `bugfix`, or `release`) with a topic slug derived from the work context gathered in Steps 3–4.
   - For meaningful completed slices of work, create atomic commits during implementation rather than waiting until the very end.
   - If the work originated from a GitHub issue (passed as the argument), include `closes #<issue-number>` in the commit body of the commit that resolves the issue. Do not guess issue numbers.
   - Keep changes minimal and directly tied to the request.
   - Match existing style and avoid unrelated refactors.
   - Use GitHub context and linked URLs as supporting material, not as permission to expand scope.

7. **Verify and report**
   - Run the smallest relevant checks.
   - Summarize what you changed, what you verified, and any open questions.

## Examples

- `/pac-lwot fix the README install instructions`
- `/pac-lwot https://github.com/owner/repo/issues/123`
- `/pac-lwot https://github.com/owner/repo/pull/456`
- `/pac-lwot https://example.com/spec-notes`
- `/pac-lwot TODO-abc123`

**Provided arguments**: $@
