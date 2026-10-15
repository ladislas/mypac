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
- Rename a prompt-backed slash command

## Process

1. **Gather requirements**
   - What should the command do?
   - What arguments, if any, can `$@` contain?
   - Is this command for planning, implementation, review, or another focused workflow?
2. **Draft the prompt**
   - Keep the static instructions precise and self-contained.
   - Add `argument-hint` only when the command takes meaningful arguments.
   - Place `$@` at the very end of the file.
3. **Review the command**
   - Check naming, frontmatter, argument placement, and any renamed command references.
   - Test with a representative invocation or review the rendered prompt end-to-end.

## Repo contract

A prompt file is a Markdown file placed in `prompts/`. Pi exposes it as a slash command whose name matches the filename without the `.md` extension. For example, `prompts/pac-foo.md` becomes `/pac-foo`.

Use the `pac-` prefix for every repo-owned prompt:

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

- `description` is required. Write it as a specific, action-oriented sentence that distinguishes this command from similar ones.
- `argument-hint` is optional. Include it when the command takes meaningful arguments (for example `"[issue URL | free text]"`). Omit it when the command takes no arguments.

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

## Prompt structure

Keep the static body as precise as possible:

1. **One-line intent** — restate what the command does in plain English.
2. **Input specification** — describe exactly what `$@` may contain and how to interpret it.
3. **Behavior steps** — give the model verifiable steps in execution order.
4. **Examples** — add a few representative invocations when the input shape is non-obvious.
5. **`$@` injection** — make it the last line of the file.
6. **Command-name references** — update slash-command references when renaming the file.

Not every prompt needs every section. Keep simple commands simple, and add structure only when it reduces ambiguity.

## When to add examples or argument hints

Add examples when:

- the accepted input formats are easy to misuse
- the command accepts several different kinds of inputs
- a concrete invocation makes the expected behavior much clearer

Add `argument-hint` when the command takes meaningful arguments. Skip it for no-argument prompts.

## Review checklist

- [ ] File is named `pac-<name>.md` and lives under `prompts/`
- [ ] Frontmatter has a specific, action-oriented `description`
- [ ] `argument-hint` is present only when the command takes arguments
- [ ] `$@` appears only once and is the last thing in the file
- [ ] Static instructions are complete and self-contained without `$@`
- [ ] Slash-command references were updated if the file was renamed
- [ ] The command works end-to-end with at least one manual invocation or a review of the rendered output
