## Context

This repository already documents durable AI workflow decisions in `docs/` and keeps `opencode`-specific guidance in `.opencode/`. OpenSpec should fit into that structure without replacing the repo's existing conventions or turning simple work into heavy process.

## Goals / Non-Goals

**Goals:**
- Make OpenSpec available in this repository through the generated `opencode` commands and skills.
- Document how OpenSpec is installed and used so the workflow is understandable without external context.
- Preserve a lightweight, human-in-the-loop workflow where specs guide implementation but do not replace code review or manual edits.

**Non-Goals:**
- Mandate OpenSpec for every change in the repository.
- Automate full implementation from specs without review checkpoints.
- Replace existing repo guidance in `AGENTS.md` and `.opencode/AGENTS.md` with generated defaults.

## Decisions

- Keep OpenSpec setup project-local while documenting that the CLI is typically installed globally or invoked with `npx`.
  - This matches how OpenSpec actually works: the command is available on a machine, but the workflow artifacts belong to each repository.
- Commit meaningful OpenSpec artifacts under `openspec/`.
  - The repository is intended to preserve rationale and repeatable workflows, so proposal, spec, design, and task files are useful history rather than disposable scaffolding.
- Add a dedicated playbook in `docs/playbooks/openspec.md` and link it from `README.md`.
  - This keeps the workflow guidance with the rest of the repo's durable operational knowledge.
- Extend `.opencode/AGENTS.md` with repo-specific OpenSpec rules.
  - Generated commands alone are not enough; future agent sessions should also know when to use OpenSpec, what to commit, and how much autonomy is expected.

## Risks / Trade-offs

- [Process overhead on trivial work] -> Mitigate by documenting a clear threshold: use OpenSpec for meaningful, multi-step changes and skip it for obvious one-off edits.
- [Spec artifacts becoming stale] -> Mitigate by keeping them concise and committing them only when they reflect real implementation intent.
- [Confusion between generated OpenSpec guidance and repo conventions] -> Mitigate by keeping repo-specific rules in `README.md` and `.opencode/AGENTS.md`.
