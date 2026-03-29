---
description: Implement tasks from an OpenSpec change (Experimental)
---

# Implement tasks from an OpenSpec change

Optionally specify a change name (e.g., `/pac-apply add-auth`). If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

## Steps

1. **Select the change**

   If a name is provided, use it. Otherwise:

   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `openspec list --json` to get available changes and use the **AskUserQuestion tool** to let the user select

   Always announce: `Using change: <name>` and how to override (e.g., `/pac-apply <other>`).

2. **Check status to understand the schema**

   ```bash
   openspec status --change "<name>" --json
   ```

   Parse the JSON to understand:

   - `schemaName`: The workflow being used (e.g., "spec-driven")
   - Which artifact contains the tasks (typically "tasks" for spec-driven, check status for others)

3. **Get apply instructions**

   ```bash
   openspec instructions apply --change "<name>" --json
   ```

   This returns:

   - Context file paths (varies by schema)
   - Progress (total, complete, remaining)
   - Task list with status
   - Dynamic instruction based on current state

   Handle states:

   - If `state: "blocked"` (missing artifacts): show message, suggest using the matching continue/change workflow command or skill
   - If `state: "all_done"`: congratulate, suggest archive
   - Otherwise: proceed to implementation

4. **Read context files**

   Read the files listed in `contextFiles` from the apply instructions output.
   The files depend on the schema being used:

   - **spec-driven**: proposal, specs, design, tasks
   - Other schemas: follow the contextFiles from CLI output

5. **Show current progress**

   Display:

   - Schema being used
   - Progress: "N/M tasks complete"
   - Remaining tasks overview
   - Dynamic instruction from CLI

6. **Implement tasks (loop until done or blocked)**

   For each pending task or small coherent batch of pending tasks:

   1. Show which task or batch is being worked on.
   2. Delegate the scoped implementation work ONLY through the **Task tool** using `subagent_type: "general"`; do not implement the scoped work directly in the main agent context.
   3. Keep the delegated scope minimal and focused on the requested change.
   4. Require the delegated work to report what changed, how it was verified, and any blockers or uncertainty.
   5. Review the delegated result in the main agent context before deciding whether the scoped work is actually complete.
   6. Commit during implementation, not only at the end.
   7. Prefer one atomic commit per meaningful numbered task section or task group once it is complete and verified.
   8. Include the corresponding `tasks.md` checkbox updates in that same commit so the task list matches the code state.
   9. Do not create one commit per tiny checkbox or file.
   10. Select the file list for each commit explicitly; if unrelated files are already staged, leave them out of the current commit.
   11. Mark task complete in the tasks file only after the delegated work has been reviewed and confirmed: `- [ ]` → `- [x]`.
   12. Continue to the next task or small coherent batch.

   Pause if:

   - Task is unclear → ask for clarification
   - Implementation reveals a design issue → suggest updating artifacts
   - Error or blocker encountered → report and wait for guidance
   - User interrupts

7. **On completion or pause, show status**

   Display:

   - Tasks completed this session
   - Overall progress: "N/M tasks complete"
   - If all done: suggest archive
   - If paused: explain why and wait for guidance

## Output During Implementation

```markdown
## Implementing: <change-name> (schema: <schema-name>)

Working on task 3/7: <task description>
[...implementation happening...]
✓ Task complete

Working on task 4/7: <task description>
[...implementation happening...]
✓ Task complete
```

## Output On Completion

```markdown
## Implementation Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 7/7 tasks complete ✓

### Completed This Session
- [x] Task 1
- [x] Task 2
...

All tasks complete! You can archive this change with `/pac-archive`.
```

## Output On Pause (Issue Encountered)

```markdown
## Implementation Paused

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 4/7 tasks complete

### Issue Encountered
<description of the issue>

**Options:**
1. <option 1>
2. <option 2>
3. Other approach

What would you like to do?
```

## Guardrails

- Keep going through tasks until done or blocked
- Always read context files before starting (from the apply instructions output)
- If task is ambiguous, pause and ask before implementing
- If implementation reveals issues, pause and suggest artifact updates
- Keep code changes minimal and scoped to each task
- Use the main agent as the orchestrator; do not let delegated execution become whole-change autonomy
- Create atomic commits during implementation for meaningful task groups, not one giant commit at the end
- For OpenSpec work, keep the relevant `tasks.md` checkbox updates in the same commit as the implementation slice they describe
- Use explicit file selection for each commit instead of assuming the full staging area belongs together
- Update task checkbox immediately after the delegated slice is reviewed and confirmed complete
- Pause on errors, blockers, or unclear requirements - don't guess
- Use contextFiles from CLI output, don't assume specific file names

## Fluid Workflow Integration

This skill supports the "actions on a change" model:

- **Can be invoked anytime**: Before all artifacts are done (if tasks exist), after partial implementation, interleaved with other actions
- **Allows artifact updates**: If implementation reveals design issues, suggest updating artifacts - not phase-locked, work fluidly
