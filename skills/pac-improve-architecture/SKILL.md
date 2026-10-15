---
name: pac-improve-architecture
description: "Review codebase architecture for deepening opportunities, then grill a candidate. Use only when the user explicitly asks for codebase architecture, module/interface deepening, or architectural refactoring—not for general product ideation or exploration."
license: MIT
compatibility: Pi coding agent
metadata:
  author: mypac
  stage: shared
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones. The aim is testability and **locality** — changes, bugs, and understanding concentrated where they belong.

This skill is standalone-first but issue-aware. When the work comes from a GitHub issue or PR, treat that context as scope and constraint input. Do not turn this skill into a GitHub write-back workflow — use `pac-grill-with-docs` when the user wants durable PRD or ADR updates.

## Glossary

Use these terms exactly in every suggestion. Consistent language is the point — don't drift into "component," "service," "API," or "boundary." Full definitions in [LANGUAGE.md](LANGUAGE.md).

- **Module** — anything with an interface and an implementation (function, class, package, slice).
- **Interface** — everything a caller must know to use the module: types, invariants, error modes, ordering, config. Not just the type signature.
- **Implementation** — the code inside.
- **Depth** — leverage at the interface: a lot of behaviour behind a small interface. **Deep** = high leverage. **Shallow** = interface nearly as complex as the implementation.
- **Seam** — where an interface lives; a place behaviour can be altered without editing in place. (Use this, not "boundary.")
- **Adapter** — a concrete thing satisfying an interface at a seam.
- **Leverage** — what callers get from depth.
- **Locality** — what maintainers get from depth: change, bugs, knowledge concentrated in one place.

Key principles (see [LANGUAGE.md](LANGUAGE.md) for the full list):

- **Deletion test**: imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep.
- **The interface is the test surface.**
- **One adapter = hypothetical seam. Two adapters = real seam.**

This skill is informed by the project's domain model — `CONTEXT.md`, plus any issue comments or PR notes that capture settled decisions. The domain language gives names to good seams; issue-backed decisions record constraints the skill should not casually re-litigate.

## Process

### 1. Resolve context and constraints

Resolve the work from the explicit issue/PR URL or current conversation.

When issue-backed context exists:

- Read the issue or PR title, body, status, and the most relevant comments before exploring.
- Treat linked PRD comments as planning context and linked ADR comments or `## Decisions` notes as constraints.
- Prefer the newest linked artifact that actually contains the expected marker when several iterations exist.
- If a linked artifact is missing, stale, or unreadable, say so plainly and fall back to the minimum direct context needed.

For free-form requests, restate the goal in your own words before exploring.

### 2. Explore

Read existing local documentation first:

- `CONTEXT.md`
- Any repo docs directly relevant to the area under review

If these files don't exist, proceed silently — don't suggest creating them upfront.

Then explore the codebase organically and note where you experience friction:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow** — interface nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but the real bugs hide in how they're called (no **locality**)?
- Where do tightly-coupled modules leak across their seams?
- Which parts of the codebase are untested, or hard to test through their current interface?

Apply the **deletion test** to anything you suspect is shallow: would deleting it concentrate complexity, or just move it? A "yes, concentrates" is the signal you want.

### 3. Present candidates

Present a numbered list of deepening opportunities. For each candidate:

- **Files** — which files/modules are involved
- **Problem** — why the current architecture is causing friction
- **Solution** — plain English description of what would change
- **Benefits** — explained in terms of locality and leverage, and also in how tests would improve

**Use `CONTEXT.md` vocabulary for the domain, and [LANGUAGE.md](LANGUAGE.md) vocabulary for the architecture.** If `CONTEXT.md` defines "Order," talk about "the Order intake module" — not "the FooBarHandler," and not "the Order service."

If issue, PR, or prior decisions impose constraints, carry them through each candidate explicitly. If a candidate contradicts a linked ADR comment or other settled decision, only surface it when the friction is real enough to justify reopening that decision. Mark the conflict clearly.

Do not propose interfaces yet. Ask the user: "Which of these would you like to explore?"

If no meaningful candidates are found, say so plainly and explain why — do not manufacture weak ones.

### 4. Grilling loop

Once the user picks a candidate, drop into a grilling conversation. Walk the design tree with them — constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive.

Ask one question at a time when that keeps the design tree clear. If the codebase or issue context can answer a question, explore instead of asking.

Side effects stay proposal-first:

- **Naming a deepened module after a concept not in `CONTEXT.md`?** Propose the exact `CONTEXT.md` addition first. If `CONTEXT.md` doesn't exist yet, propose creating it with that entry. Only write it after explicit confirmation.
- **Sharpening a fuzzy domain term during the conversation?** Propose the exact `CONTEXT.md` change first.
- **User rejects the candidate with a load-bearing reason?** Suggest recording it through `pac-grill-with-docs` when that reason should persist as a future decision.
- **Want durable PRD or ADR write-back?** Suggest switching to or chaining with `pac-grill-with-docs`.
- **Want to explore alternative interfaces for the deepened module?** See [INTERFACE-DESIGN.md](INTERFACE-DESIGN.md).

Do not auto-write GitHub comments, ADRs, PRDs, or `CONTEXT.md` changes from this skill alone.
