## Context

This repository already expects atomic commits in spirit, but the rule currently lives in fragments: the commit helper talks about logical groups, one archived OpenSpec change mentions task-group commits, and the broader workflow docs only say to work in small slices. That leaves too much room for bad agent behavior, especially when implementation moves quickly and the staging area contains extra files. The result is predictable and dumb: either one giant end-of-work commit, or a commit that scoops up unrelated staged files because nobody forced an explicit file list.

The change needs a single repository-level convention that can be repeated consistently across OpenSpec workflow docs, manual workflow guidance, and agent instructions.

## Goals / Non-Goals

**Goals:**

- Define one commit model that applies to both OpenSpec-driven implementation and manual todo-driven implementation.
- Require commits to align to coherent, verifiable progress boundaries rather than end-of-change batching or per-file micromanagement.
- Require explicit commit file selection so unrelated staged files are excluded from a commit group.
- Make the `/pac-apply` command, the `pac-openspec-apply-change` skill, and repository guidance all describe the same behavior.

**Non-Goals:**

- Changing git hooks, staging mechanics, or git defaults.
- Enforcing commit grouping automatically with new tooling.
- Rewriting the entire commit helper workflow beyond the guidance needed to prevent accidental unrelated-file commits.

## Decisions

### Decision: Define atomic commits as coherent, verified progress units

Repository guidance will define an atomic implementation commit as one coherent, reviewable, verifiable unit of progress. The guidance will explicitly reject both extremes: waiting until the entire change is done, and creating tiny commits per file or trivial checkbox.

**Alternatives considered:**

- **Only say "commit in small slices":** rejected because it is too vague and does not prevent giant end-of-work commits.
- **Require a commit for every subtask or file:** rejected because it produces noisy history and weak review boundaries.

### Decision: OpenSpec task groups are the default commit boundary for planned changes

For OpenSpec changes, the preferred commit boundary will be the meaningful numbered task section or task group in `tasks.md`. The guidance will instruct implementers to finish and verify a section before creating its commit, while allowing multiple tiny checkboxes inside that section to stay uncommitted until the section forms a coherent unit. The same commit must include the corresponding `tasks.md` checkbox updates for the completed slice so the code and task list remain in sync at every review boundary.

**Alternatives considered:**

- **Commit only when all tasks are done:** rejected because it hides progress boundaries and makes review and rollback harder.
- **Commit after every checkbox:** rejected because task lists often include tiny bookkeeping items that do not deserve their own commit.

### Decision: OpenSpec task completion updates travel with the implementation slice

For OpenSpec-driven work, the relevant `tasks.md` checkbox updates must be committed in the same atomic commit as the implementation slice they describe. This keeps the history honest: each commit shows both the code state and the matching task-tracking state for that slice.

**Alternatives considered:**

- **Flip task checkboxes in a later bookkeeping commit:** rejected because it lets `tasks.md` drift behind the code and makes progress review less trustworthy.
- **Update every checkbox immediately in its own commit:** rejected because it creates the same noisy micro-commit problem as per-file commits.

### Decision: Manual work uses the same rule with explicit task grouping

When work is not using OpenSpec, the same atomic-commit rule will apply, but the grouping source becomes the active manual task list or clearly stated work slices. This keeps the behavior consistent across workflows instead of treating non-OpenSpec work as a history-free-for-all.

**Alternatives considered:**

- **Limit the rule to OpenSpec only:** rejected because the user problem also appears during manual work and agent-led todo execution.

### Decision: Commit file lists must be explicit, not inferred from the full staging area

Guidance will explicitly require selecting the files for each commit group on purpose. If unrelated files are already staged, they must be left out of the current commit rather than swept in just because they are present. This preserves atomic history and reduces user friction when the staging area contains leftovers from another thread of work.

**Alternatives considered:**

- **Assume the staging area already represents the desired commit:** rejected because it fails in exactly the common case this change is addressing.
- **Require a fully clean staging area before every commit:** rejected because it is stricter than necessary; the real requirement is explicit file selection for the current logical unit.

## Risks / Trade-offs

- **More explicit commit guidance may feel repetitive across docs** → Mitigation: keep the wording short and reuse the same core phrasing everywhere.
- **"Meaningful task group" still requires judgment** → Mitigation: anchor the examples to numbered OpenSpec sections and coherent manual todo slices.
- **Manual work may not always have a written task list** → Mitigation: instruct agents to define the intended commit group before staging or committing.

## Migration Plan

1. Update the OpenSpec workflow spec so the rule becomes part of the repository contract.
2. Update `/pac-apply`, `pac-openspec-apply-change`, and repository guidance to mirror that contract.
3. Update agent and commit helper guidance so commits use explicit file lists and ignore unrelated staged files.
4. Verify the resulting docs all describe the same commit model.

## Open Questions

- None.
