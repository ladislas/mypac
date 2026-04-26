# OpenSpec

## Goal

Use OpenSpec as the planning layer for meaningful, multi-step work in this repository without turning simple tasks into process.

## In this repository

- The day-to-day interface is Pi.
- Launch Pi locally with `mise run pi`.
- Use the Pi prompts for the main workflow:
  - `/pac-propose`
  - `/pac-explore`
  - `/pac-apply`
  - `/pac-archive`
- Use the `openspec` CLI for setup, updates, direct inspection, and low-level control.

## Setup

- OpenSpec project repo: `https://github.com/Fission-AI/OpenSpec`
- Install OpenSpec globally if you want the CLI available everywhere:
  - `npm install -g @fission-ai/openspec@latest`
- Or invoke it ad hoc with `npx`:
  - `npx @fission-ai/openspec@latest init --tools pi .`
- Initialize each repository independently.
- After upgrading OpenSpec, refresh generated instructions with `openspec update`.

## Quick Cheat Sheet

- I want to start a new planned change from an idea -> use `/pac-propose "idea"`
- I want the agent to keep working through an OpenSpec change in-session -> use `/pac-apply`
- I want to browse or refine a change conversationally -> use `/pac-explore`
- I want to close out a finished change trail -> use `/pac-archive`
- I want to set up OpenSpec in a repo -> use `openspec init --tools pi .`
- I want to refresh generated instructions after upgrading OpenSpec -> use `openspec update`
- I want to inspect exact change status from the terminal -> use `openspec status --change "change-name"`
- I want direct/manual control over change creation -> use `openspec new change "change-name"`

## Recommended Default

- Default to Pi prompts while you are actively working in the repository.
- Reach for the CLI when you are setting up a repo, debugging the workflow, or checking exact state.
- If both could work, prefer the prompt first because it keeps planning, implementation, and review in one place.

## Quick Session Recipe

1. Start a meaningful change with `/pac-propose "idea"`.
2. Review and edit the generated proposal, specs, design, and tasks yourself.
3. If the change started from an explicit GitHub issue, include `closes #<issue>` in the body of the first commit that captures the OpenSpec planning artifacts so merging the branch autocloses the issue.
4. Implement one small slice at a time with `/pac-apply` or with manual edits.
5. For OpenSpec work, update the relevant `tasks.md` checkboxes in the same commit as the completed implementation slice.
6. Commit each meaningful task group or manual work slice once it is complete and verified.
7. Select the file list for each commit explicitly; if unrelated files are already staged, leave them out of the current commit.
8. Review the code and adjust artifacts if scope or decisions changed.
9. Archive and commit the change trail when the work is complete and worth preserving.

## When to Use It

Use OpenSpec when the change is:

- multi-step or likely to span more than one session
- ambiguous enough to benefit from a proposal before coding
- architectural, cross-file, or easy to mis-scope
- worth preserving as rationale for future review or archaeology

Skip OpenSpec when the task is:

- a tiny fix, typo, or obvious one-file edit
- easy to complete in a single focused pass
- not improved by a proposal, spec, or task trail

## Repository Conventions

- OpenSpec artifacts live under `openspec/`.
- Meaningful `proposal.md`, `design.md`, `specs/`, and `tasks.md` artifacts are committed when they capture durable context.
- Archived OpenSpec change trails are kept only when they remain safe and useful as repository context; remove archived changes whose main content is deprecated or unsupported behavior.
- Commit implementation work during execution, not only at the end of the whole change.
- For OpenSpec changes, prefer one atomic commit per meaningful numbered task section once that section is complete and verified.
- For OpenSpec changes, include the corresponding `tasks.md` checkbox updates in the same commit as the completed implementation slice.
- When an OpenSpec change starts from an explicit GitHub issue, include `closes #<issue>` in the body of the first commit that captures the planning artifacts so merging the branch autocloses the issue.
- For manual work outside OpenSpec, use the same atomic-commit rule with coherent manual task groups.
- Do not create one commit per file or tiny checkbox, and do not batch unrelated work into one large commit.
- Select the file list for each commit explicitly; if unrelated files are already staged, leave them out of the current commit.
- Keep artifacts short, current, and decision-oriented.
- Prefer updating existing artifacts over creating verbose parallel notes.

## Human-in-the-Loop Workflow

1. Start with a proposal for the change.
2. Review and edit the proposal yourself before implementation.
3. If the work began from an explicit GitHub issue, make sure the first planning commit includes `closes #<issue>` in its body.
4. Add or refine specs and design only to the level that improves execution.
5. Implement in small slices, reviewing code between slices.
6. For OpenSpec work, commit the matching `tasks.md` checkbox updates in the same commit as each completed slice.
7. Commit each coherent, verified implementation slice as you go.
8. Use an explicit file list for each commit instead of assuming the full staging area belongs together.
9. Commit the OpenSpec trail with the code when it explains why the change exists or how it was scoped.

OpenSpec is a planning scaffold, not an autopilot. The human stays responsible for scope, design judgment, code review, and final approval.

## Useful Commands

- `openspec init --tools pi .`
- `openspec update`
- `openspec new change "change-name"`
- `openspec status --change "change-name"`
