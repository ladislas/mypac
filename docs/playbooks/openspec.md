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
- In this repo, the shared OpenCode kit is rooted at the repository root through `agents/`, `commands/`, `plugins/`, and `skills/`.
- For local day-to-day work here, use `mise run opencode` so `OPENCODE_CONFIG_DIR` is pointed at the repository root for you.

## Shared Kit Reuse

- Shared reusable OpenCode assets live in this repository's root-level `agents/`, `commands/`, `plugins/`, and `skills/` directories.
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
- I want a default structured review of the current change -> use `/pac-review`
- I want an independent skeptical pass on the same change -> use `/pac-review-adversarial`
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
4. Run `/pac-review` before shipping or when you want a structured pass on correctness, scope alignment, maintainability, and verification gaps.
5. Add `/pac-review-adversarial` when the change is high risk, easy to be overconfident about, or worth pressure-testing for hidden assumptions and subtle failure modes.
6. For maximum adversarial independence, prefer running `/pac-review-adversarial` in a fresh session instead of relying on model changes alone.
7. For OpenSpec work, update the relevant `tasks.md` checkboxes in the same commit as the completed implementation slice.
8. Commit each meaningful task group or manual work slice once it is complete and verified.
9. Select the file list for each commit explicitly; if unrelated files are already staged, leave them out of the current commit.
10. Review the code and adjust artifacts if scope or decisions changed.
11. Archive and commit the change trail when the work is complete and worth preserving.

## Review Workflows

- `/pac-review` is the standard review pass. Use it by default for most meaningful changes, especially when you want to catch correctness problems, requirement mismatch, maintainability issues, and missing tests or runtime evidence.
- `/pac-review-adversarial` is the skeptical pass. Use it when you want stronger pressure-testing for hidden assumptions, edge cases, rollback concerns, and places where the first pass might be too trusting.
- Both review commands are analysis only. They should not edit files, apply fixes, stage changes, or create commits.
- Fresh delegated context is the default review isolation mechanism for both commands. That keeps the main thread cleaner and reduces automatic reuse of earlier reasoning.
- For the strongest practical independence, run `/pac-review-adversarial` in a fresh session. Fresh delegated context is the baseline; a fresh session is the stronger option.

## Review Usage Patterns

- Use standard review alone for routine changes where one strong structured pass is enough.
- Use adversarial review alone when you specifically want a skeptical second opinion on risk, failure modes, or rollback concerns and do not need the standard baseline first.
- Use the paired flow for higher-risk changes: run `/pac-review` first, then `/pac-review-adversarial` on the same target, and compare overlapping findings, unique findings, contradictions, and unresolved verification gaps.

## Alignment With Runtime And Routing Guidance

- Review workflows should use runtime-awareness context only when it helps interpret the review target or delegated routing behavior. This matches `openspec/specs/agent-runtime-awareness/spec.md`, which exposes current agent, previous agent, and active model for reviewer workflows.
- Standard review should follow the current routing defaults.
- Adversarial review should prefer independence from fresh delegated context first, not from automatic model churn. This matches `docs/playbooks/model-routing.md`.
- If delegated model override is available, use it as an explicit optional strengthening step for adversarial review rather than the default path.

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
- Commit implementation work during execution, not only at the end of the whole change.
- For OpenSpec changes, prefer one atomic commit per meaningful numbered task section once that section is complete and verified.
- For OpenSpec changes, include the corresponding `tasks.md` checkbox updates in the same commit as the completed implementation slice.
- For manual work outside OpenSpec, use the same atomic-commit rule with coherent manual task groups.
- Do not create one commit per file or tiny checkbox, and do not batch unrelated work into one large commit.
- Select the file list for each commit explicitly; if unrelated files are already staged, leave them out of the current commit.
- Keep artifacts short, current, and decision-oriented.
- Prefer updating existing artifacts over creating verbose parallel notes.

## Human-in-the-Loop Workflow

1. Start with a proposal for the change.
2. Review and edit the proposal yourself before implementation.
3. Add or refine specs and design only to the level that improves execution.
4. Implement in small slices, reviewing code between slices.
5. For OpenSpec work, commit the matching `tasks.md` checkbox updates in the same commit as each completed slice.
6. Commit each coherent, verified implementation slice as you go.
7. Use an explicit file list for each commit instead of assuming the full staging area belongs together.
8. Commit the OpenSpec trail with the code when it explains why the change exists or how it was scoped.

OpenSpec is a planning scaffold, not an autopilot. The human stays responsible for scope, design judgment, code review, and final approval.

## Useful Commands

- `openspec init --tools opencode .`
- `openspec update`
- `openspec new change "change-name"`
- `openspec status --change "change-name"`

In `opencode`, use the generated OpenSpec slash commands to propose, explore, apply, and archive changes.
