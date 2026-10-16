---
name: pac-writing-for-agents
description: "Author agent-facing instructions. Use when creating, editing, renaming, or restructuring skills, Pi prompts, AGENTS.md, shared system instructions, personas, or referenced instruction documents."
license: MIT
metadata:
  author: mypac
  stage: shared
---

# Writing for agents

Write instructions that reliably change agent behavior, with clear routing and observable completion criteria.

Adapted selectively from Matt Pocock's [writing-for-agents](https://github.com/mattpocock/skills/tree/main/skills/productivity/writing-for-agents) guidance. Original skill-authoring provenance: [write-a-skill at the accepted historical baseline](https://github.com/mattpocock/skills/blob/d54c497aa94400a496d3f2c38be10fa5f284c5a9/skills/productivity/write-a-skill/SKILL.md). See [upstream license](UPSTREAM_LICENSE.md).

## Choose the mechanics and policy owner

- For skill creation, renaming, or layout changes, read [SKILL-MECHANICS.md](SKILL-MECHANICS.md) for Pi skill structure, frontmatter, discovery descriptions, support files, scripts, and packaging checks.
- For slash-command templates in `prompts/`, read [pac-writing-for-pi](../pac-writing-for-pi/SKILL.md) for Pi prompt mechanics.
- For extension implementation, use [pac-pi-extension](../pac-pi-extension/SKILL.md).

Keep repository policy in `AGENTS.md` and shared system instructions, and domain procedures in their specialized skills. This skill governs writing methodology, not branch, commit, publication, review, or runtime policy. Reference the owner instead of copying its rules. Preserve persona voice and specialized workflow requirements while improving their clarity.

## Process

1. **Define the behavior.** Identify the reader, task, trigger branches, required inputs, policy owner, and intended result. Resolve material ambiguity with the user before drafting. Finish with a concrete statement of what the agent should do differently.
2. **Choose the information hierarchy.** Separate ordered actions from reference material. Keep universally needed instructions in the main path; disclose branch-specific material through conditional pointers. Finish when each branch can reach its required instructions without loading unrelated material.
3. **Draft locally.** Put each concept's definition, rules, exceptions, and examples together. Give each action a checkable completion criterion. Finish when the agent can distinguish done from not done without guessing.
4. **Review the execution path.** Walk a representative input through each distinct branch, including ambiguous input and failure handling where applicable. Check affected references and rendered or discovered resources. Finish with evidence that routing, requirements, and completion checks survive the change.

## Context pointers and trigger branches

A context pointer names material outside the current context and states when to read it. Skill descriptions, `AGENTS.md` routing lines, and support-file links all serve this role.

- State the target's capability and the distinct cases that require it. Cover branches, not a list of synonyms for one case.
- Use concrete task words and paths the user or agent will encounter. Put the distinguishing concept early.
- If required material is missed, sharpen its pointer before inlining the entire target.
- Inline what every branch needs; link what only some branches need. Keep required references directly reachable rather than hiding them behind a chain of optional reads.

Example:

```markdown
For slash-command templates in prompts/, read pac-writing-for-pi for frontmatter and argument placement.
```

This names a trigger and a purpose; “see writing guidance” does neither.

## Hierarchy and co-location

Use ordered steps for execution and headings for reference. Keep the main path visible: lengthy definitions or examples between actions belong in a reference section or a conditionally loaded support file.

Split when branches need different material, not merely to reach an arbitrary file length. Keep a concept's caveats beside its rule so loading one brings the other. Prefer one authoritative definition over repetitions in checklists, sibling skills, and always-loaded routing text.

## Completion criteria

Make completion both checkable and exhaustive for the actual scope. “Review the references” is weaker than “every renamed path resolves and no active consumer uses the old name.” Choose a criterion that proves the required behavior rather than merely producing an artifact.

Sharpen a vague bound before adding more steps. Split a sequence across a real context boundary only when observed premature completion warrants it; separate headings in one loaded file do not hide later steps.

## Pruning

Review sentence by sentence: does this instruction change behavior for the intended agent and task? Remove ineffective instructions and duplicated meanings, not just excess words. Verify uncertain cases with representative runs instead of assuming what every model does by default.

Prefer a positive target action over a prohibition alone. Keep necessary safety guardrails and pair them with the safe action; writing brevity is not permission to weaken policy. Use consistent, familiar terms rather than introducing a vocabulary the workflow does not need.

## Review checklist

- [ ] Scope, distinct trigger branches, and policy ownership are clear.
- [ ] Each branch reaches the instructions it needs; optional material has explicit read conditions.
- [ ] Related rules and caveats are co-located, with one authoritative home per meaning.
- [ ] Actions end on checkable criteria covering the requested scope.
- [ ] Instructions add behavioral value; duplicates and stale guidance are removed without weakening guardrails.
- [ ] Representative execution paths and any renamed references were checked.
- [ ] Applicable skill or prompt mechanics checks pass.
