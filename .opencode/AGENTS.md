# Project Preferences

## Tooling

This project uses [opencode](https://opencode.ai) as the AI coding assistant.
Do NOT suggest or create configurations for vendor-specific CLIs (Claude Code, Codex, etc.).

- Shared kit assets belong at the repository root in `agents/`, `commands/`, `plugins/`, and `skills/`
- Project-local overlay assets belong in `.opencode/`
- Do NOT place them in `.claude/`, `.cursor/`, or any other vendor-specific directory

## OpenSpec Workflow

- OpenSpec is available in this repo as the planning layer for meaningful multi-step changes.
- OpenSpec artifacts live under `openspec/`; the shared kit lives at the repository root and project-local overlays stay under `.opencode/`.
- Use OpenSpec for non-trivial features, refactors, migrations, and ambiguous bugfixes.
- Skip OpenSpec for tiny obvious edits that do not benefit from proposal/spec/task artifacts.
- Commit meaningful OpenSpec artifacts when they preserve rationale, review context, or implementation history.
- Commit implementation work during the change, not only at the end.
- Use one atomic commit per meaningful task group or work slice once it is complete and verified.
- For OpenSpec changes, include the corresponding `tasks.md` checkbox updates in the same commit as the completed slice.
- Do not create one commit per tiny checkbox or file, and do not batch unrelated work into one large commit.
- Select commit files explicitly; if unrelated files are already staged, leave them out of the current commit.
- Keep the human in the loop: treat OpenSpec as a scaffold for planning and review, not a fire-and-forget implementation engine.
