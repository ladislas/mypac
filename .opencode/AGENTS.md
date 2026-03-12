# Project Preferences

## Tooling

This project uses [opencode](https://opencode.ai) as the AI coding assistant.
Do NOT suggest or create configurations for vendor-specific CLIs (Claude Code, Codex, etc.).

- Skills, rules, and workflow configurations belong in `.opencode/`
- Do NOT place them in `.claude/`, `.cursor/`, or any other vendor-specific directory

## OpenSpec Workflow

- OpenSpec is available in this repo as the planning layer for meaningful multi-step changes.
- OpenSpec artifacts live under `openspec/` and repo-local commands/skills live under `.opencode/`.
- Use OpenSpec for non-trivial features, refactors, migrations, and ambiguous bugfixes.
- Skip OpenSpec for tiny obvious edits that do not benefit from proposal/spec/task artifacts.
- Commit meaningful OpenSpec artifacts when they preserve rationale, review context, or implementation history.
- Keep the human in the loop: treat OpenSpec as a scaffold for planning and review, not a fire-and-forget implementation engine.
