# Pi skill mechanics

Use this reference when creating, renaming, or refactoring a repo-owned skill. General authoring methodology lives in `SKILL.md`; this file owns skill packaging and discovery checks.

## Process

1. **Gather requirements**
   - What task does the skill cover?
   - What concrete triggers should cause Pi to load it?
   - Does it need only instructions, or also support files or scripts?
2. **Draft the skill**
   - Write `SKILL.md` with concise instructions.
   - Add support files only when they make the skill clearer or more reliable.
   - Keep skill-specific files inside the skill directory.
3. **Review the change**
   - Check naming, descriptions, references, and any renamed paths.
   - Ask the user to confirm when the desired behavior or scope is still ambiguous.

## Repo contract

Use a directory containing `SKILL.md`. This repository requires the frontmatter `name` to match the parent directory exactly, preserving portable Agent Skills structure.

Use this shape:

```text
skills/pac-<name>/
  SKILL.md
  [support files]
```

Every `SKILL.md` must open with this frontmatter block:

```yaml
---
name: pac-<name>
description: "<one-sentence capability>. Use when <concrete triggers>."
license: MIT
metadata:
  author: mypac
  stage: shared
---
```

Add `compatibility` only when the skill has real environment requirements. Runtime-neutral skills should omit it; do not use it merely to name the client where the skill originated.

Rules for this repo:

- Use the `pac-` prefix for every repo-owned skill.
- Do not use unprefixed local names like `github` or `uv`.
- Keep all support files inside the skill directory.
- When renaming a skill, update `AGENTS.md`, docs, prompts, tests, and sibling skills that reference it.

## Description requirements

The `description` is what Pi sees when deciding whether to load the skill, so make it specific.

Write it in two parts:

1. What the skill does
2. `Use when ...` with concrete triggers, contexts, or file locations

Additional rules:

- **Max 1024 characters** — stay within Pi's supported description limit.
- **Write in third person** — "Author or update…" not "Use this to author or update…"

Good:

```yaml
description: "Author or update a Pi prompt file for this repo. Use when creating a new slash command or editing an existing prompt in prompts/."
```

Bad:

```yaml
description: "Helps with prompts."
```

## When to add support files

Add support files when:

- `SKILL.md` would otherwise become long or unfocused
- examples or reference material are useful but not always needed
- a deterministic helper script is more reliable than regenerated code

Common layout:

```text
skills/pac-<name>/
  SKILL.md
  REFERENCE.md
  EXAMPLES.md
  scripts/
```

## When to add scripts

Add a script (under `scripts/`) when:

- The action is deterministic and error-prone to describe in prose (e.g. renaming paths, updating multiple references)
- The script is short enough to be read and understood at a glance
- Running it produces a clear, verifiable result

Stick to prose instructions when:

- The logic depends on context that a script cannot know in advance
- A one-liner shell command is sufficient
- The action only needs to be done once and isn't worth the maintenance

## Review checklist

- [ ] Directory is named `skills/pac-<name>/`
- [ ] `SKILL.md` exists and `name` matches the directory exactly
- [ ] `description` states the capability and `Use when ...` triggers
- [ ] `description` is under 1024 chars and written in third person
- [ ] `SKILL.md` stays focused; split into support files if it grows long
- [ ] No time-sensitive information (dates, versions, "currently", "soon")
- [ ] Terminology is consistent throughout
- [ ] At least one concrete example is included where relevant
- [ ] Required references are directly reachable, with explicit conditions for optional files
- [ ] Support files stay inside the skill directory
- [ ] Renamed or moved skills have updated references
- [ ] The skill reads cleanly end-to-end without extra speculation
