---
description: "Diagnose a bug or performance regression with a disciplined feedback-loop workflow"
argument-hint: "[bug report | issue/PR URL | free text]"
---

Use the optional argument after `/pac-diagnose` as the bug or performance-regression context. It may be:

- a free-form bug report
- a GitHub issue or PR URL
- another URL
- nothing, in which case infer the bug from the conversation and ask only if unclear

Resolve the target with the minimum context needed, then read and follow `skills/pac-diagnose/SKILL.md`.

Start by building a reliable feedback loop. Do not hypothesize or fix until the reported failure is reproduced, unless you explicitly report that no loop can be built and ask for the missing artifact or access.

**Provided arguments**: $@
