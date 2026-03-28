# OpenSpec

## Goal

Use OpenSpec as the default planning layer for meaningful, multi-step work in this repository without turning simple tasks into process.

## Setup Model

- OpenSpec project repo: `https://github.com/Fission-AI/OpenSpec`
- Install OpenSpec on your machine if you want the CLI available everywhere:
  - `npm install -g @fission-ai/openspec@latest`
- Or invoke it ad hoc with `npx`:
  - `npx @fission-ai/openspec@latest init --tools opencode .`
- Initialize each repository independently.
- In this repo, the shared OpenCode kit is rooted at the repository root through `agents/`, `commands/`, and `skills/`.
- For local day-to-day work here, use `mise run opencode` so `OPENCODE_CONFIG_DIR` is pointed at the repository root for you.

## Shared Kit Reuse

- Shared reusable OpenCode assets live in this repository's root-level `agents/`, `commands/`, and `skills/` directories.
- To reuse them from another repo, point `OPENCODE_CONFIG_DIR` at `/path/to/mypac`.
- The target repository can still add its own local `.opencode/` assets.
- Keep shared skill names canonical and unique; project-local specializations must use distinct names.
- See `docs/playbooks/shared-opencode-kit.md` for the naming and layering rules.

## Which Interface to Use

- Use `opencode` slash commands for day-to-day feature work inside an active coding session.
- Use the `openspec` CLI for setup, updates, direct inspection, and low-level control.
- Think of it this way:
  - `opencode` commands = guided workflow in conversation
  - `openspec` CLI = repo/tool administration and raw state inspection

## Quick Cheat Sheet

- I want to start a new planned change from an idea -> use `/pac-propose "idea"`
- I want the agent to keep working through an OpenSpec change in-session -> use `/pac-apply`
- I want to browse or refine a change conversationally -> use `/pac-explore`
- I want to close out a finished change trail -> use `/pac-archive`
- I want to set up OpenSpec in a repo -> use `openspec init --tools opencode .`
- I want to refresh generated instructions after upgrading OpenSpec -> use `openspec update`
- I want to inspect exact change status from the terminal -> use `openspec status --change "change-name"`
- I want direct/manual control over change creation -> use `openspec new change "change-name"`

## Recommended Default

- Default to slash commands while you are actively coding in `opencode`.
- Reach for the CLI when you are setting up a repo, debugging the workflow, or checking exact state.
- If both could work, prefer the slash command first because it keeps planning, implementation, and review in one place.

## Quick Session Recipe

1. Start a meaningful change with `/pac-propose "idea"`.
2. Review and edit the generated proposal, specs, design, and tasks yourself.
3. Implement one small slice at a time with `/pac-apply` or with manual edits.
4. Review the code and adjust artifacts if scope or decisions changed.
5. Archive and commit the change trail when the work is complete and worth preserving.

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
- Keep artifacts short, current, and decision-oriented.
- Prefer updating existing artifacts over creating verbose parallel notes.

## Human-in-the-Loop Workflow

1. Start with a proposal for the change.
2. Review and edit the proposal yourself before implementation.
3. Add or refine specs and design only to the level that improves execution.
4. Implement in small slices, reviewing code between slices.
5. Commit the OpenSpec trail with the code when it explains why the change exists or how it was scoped.

OpenSpec is a planning scaffold, not an autopilot. The human stays responsible for scope, design judgment, code review, and final approval.

## Useful Commands

- `openspec init --tools opencode .`
- `openspec update`
- `openspec new change "change-name"`
- `openspec status --change "change-name"`

In `opencode`, use the generated OpenSpec slash commands to propose, explore, apply, and archive changes.
