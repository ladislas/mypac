---
name: pac-pi-prompt
description: "Author or update a Pi prompt file for this repo. Use when creating a new slash command or editing an existing prompt in prompts/."
license: MIT
compatibility: Pi coding agent
metadata:
  author: mypac
  stage: shared
---

# Author a Pi prompt for this repo

Load this skill whenever you are about to:

- Create a new prompt file under `prompts/`
- Update or restructure an existing prompt

## What a Pi prompt is

A prompt file is a Markdown file placed in `prompts/`. Pi exposes it as a slash command whose name matches the filename without the `.md` extension. For example, `prompts/pac-foo.md` becomes `/pac-foo`.

## File naming

**Use the `pac-` prefix for every repo-owned prompt.**

```text
prompts/pac-<name>.md
```

This mirrors the `pac-` convention used for skills and prevents collisions with prompts provided by external sources or other Pi packages.

## Frontmatter

Every prompt must have a frontmatter block at the top:

```yaml
---
description: "One-line summary shown in the command palette"
argument-hint: "[optional hint shown when typing the command]"
---
```

- `description` is required. Write it as an action-oriented sentence. It is the only thing the user sees in the command list, so it must be specific enough to distinguish this command from similar ones.
- `argument-hint` is optional. Include it when the command takes meaningful arguments (e.g., `"[issue URL | todo ID | free text]"`). Omit it when the command takes no arguments.

## Argument placement — the caching rule

**Always place `$@` at the very end of the prompt body.**

```markdown
---
description: "..."
---

[All static instructions here]

**Provided arguments**: $@
```

The LLM caches the static prefix of a prompt. Moving the variable part (`$@`) to the end ensures that only the final token(s) change between invocations, maximising cache reuse and minimising cost. Placing `$@` in the middle or at the top breaks this: every invocation looks like a fresh prompt to the cache.

Apply this rule even when you think the arguments will rarely vary. The cost is zero; the benefit accumulates over time.

## Prompt structure

Keep the static body as precise as possible:

1. **One-line intent** — restate what the command does in plain English, so the model has an unambiguous goal even without reading the description.
2. **Input specification** — describe exactly what `$@` may contain and how to interpret it (free text, URL, todo ID, etc.).
3. **Behavior steps** — numbered list of what the model should do, in order. Steps should be verifiable.
4. **Examples** — include two or three representative invocations when the input format is non-obvious.
5. **`$@` injection** — last line of the file.
6. **Command-name references** — if the prompt body or docs mention the slash command explicitly, update those references when renaming the file.

Not all sections are required for every prompt. A simple one-shot command may need only intent + `$@`. Add sections only when they reduce ambiguity.

## Checklist before committing a new prompt

- [ ] File is named `pac-<name>.md` and lives under `prompts/`
- [ ] Frontmatter has a specific, action-oriented `description`
- [ ] `argument-hint` is present if the command takes arguments
- [ ] `$@` appears only once and is the last thing in the file
- [ ] Static instructions are complete and self-contained without `$@`
- [ ] Command works end-to-end with at least one manual invocation or a review of the rendered output
