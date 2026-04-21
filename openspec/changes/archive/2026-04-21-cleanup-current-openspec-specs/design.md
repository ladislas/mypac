## Context

The repository's active OpenSpec specs currently overstate or misstate parts of the supported workflow. The main mismatches are: `/pac-apply` no longer promises delegated subagent execution, the pre-commit validation contract still treats `.opencode/` lint overrides as active supported behavior, and `github-task-capture` documents a `/add-task` capability that is not implemented.

This is a documentation-contract cleanup, not a feature build. The source of truth for validation is the current repository behavior visible in `README.md`, `AGENTS.md`, `docs/playbooks/openspec.md`, the `pac-apply` prompt/skill, hook configuration, and the active Pi package metadata.

## Goals / Non-Goals

**Goals:**

- Bring the current active OpenSpec specs back into alignment with the repository's real supported workflow.
- Preserve the useful current specs that still describe real behavior.
- Remove unsupported promises from the active spec surface.
- Avoid touching archived OpenSpec history.

**Non-Goals:**

- Reworking the broader repository structure or removing all legacy `.opencode/` files.
- Adding a new GitHub issue capture command or implementing new runtime capabilities.
- Refactoring prompts, skills, or hooks beyond what is required to keep the spec surface honest.

## Decisions

- Update only the current active specs in `openspec/specs/`.
  - Rationale: current specs are the living contract; archived artifacts preserve historical context and should not be casually rewritten.
  - Alternative considered: cleaning archived artifacts too. Rejected because it rewrites history without changing current behavior.

- Treat repository-observable behavior as the verification source for spec cleanup.
  - Rationale: this change is about contract accuracy, so specs should be checked against the README, AGENTS guidance, prompts, skills, package metadata, and hook config.
  - Alternative considered: preserving older wording for compatibility. Rejected because active specs should describe present support, not former intent.

- Simplify `content-precommit-validation` to the supported contract and drop `.opencode/`-specific promises.
  - Rationale: the repo is Pi-first and Pi-only for active workflow; keeping `.opencode/` override behavior as a promised active capability would make the spec surface misleading.
  - Alternative considered: keeping `.opencode/` in the active spec because files still exist. Rejected because file presence alone does not justify a supported capability contract.

- Retire `github-task-capture` from the active spec set.
  - Rationale: no current prompt, skill, or extension implements `/add-task`, so the spec is unsupported.
  - Alternative considered: leaving the spec as aspirational. Rejected because active specs should not double as backlog notes.

## Risks / Trade-offs

- [Legacy `.opencode/` files remain in the repo] → Mitigation: keep this change narrowly focused on the active OpenSpec contract instead of broad cleanup.
- [Spec cleanup could accidentally under-document real behavior] → Mitigation: verify each edited spec directly against current repository files before finalizing.
- [Removing `github-task-capture` may hide a future idea] → Mitigation: reintroduce it later through a new change proposal or GitHub issue rather than leaving an unsupported active spec.
