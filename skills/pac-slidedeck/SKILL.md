---
name: pac-slidedeck
description: "Design or refine clear presentation slide decks with a coherent narrative, focused slides, and proportionate visual structure. Use when the user explicitly asks for slides, a slide deck, presentation, pitch deck, briefing deck, or presentation refinement—not for ordinary documents or prose reports."
license: MIT
metadata:
  author: mypac
  stage: shared
---

# Design a slidedeck

Turn source material into a presentation, not a document split across pages.

## Scope

Use this workflow when the requested artifact is explicitly a presentation or slide deck. Do not activate it for ordinary document generation, summaries, reports, or notes unless the user asks to turn them into slides.

If the audience, purpose, or source material is materially ambiguous, ask at most one focused clarifying question. Otherwise proceed with the best-supported framing.

## Build the narrative

- Identify the audience, purpose, and decision or understanding the deck should enable.
- Give the deck a clear through-line: opening context, a small number of coherent sections, and a deliberate close or next step.
- Default to roughly 4–10 focused slides unless the material clearly needs a different count.
- Make each slide earn its place and carry one main idea.
- Prefer concise titles that state the point rather than merely naming the topic.
- Keep prose sparse enough to scan during a live discussion or review.

## Choose presentation structures deliberately

Use semantic slide structures only when they help the message. Common patterns include:

- cover or opening thesis;
- section divider;
- comparison or two-sided split;
- grouped cards or categories;
- KPI or metric emphasis;
- single strong statement;
- quote with attribution;
- ordered steps or timeline;
- concise table;
- simple diagram or flow.

Do not force variety for its own sake. Repeat a structure when that improves comprehension. Prefer a visual hierarchy that makes the intended reading order obvious.

## Design for clarity

- Prioritize clarity, scanability, and discussion usefulness over dense completeness.
- Use numbers, labels, and short supporting phrases where they communicate faster than paragraphs.
- Keep tables small enough to read on a slide; move detail out of the main deck when it overwhelms the point.
- Use diagrams only when relationships or flow matter; avoid decorative complexity.
- Preserve terminology from the source material when it is meaningful to the audience.

## Refinement

When refining an existing deck:

- preserve untouched slides verbatim where the host format allows it;
- change only what the request requires, plus the minimum nearby adjustments needed for consistency;
- keep the established visual language unless the user asks for a redesign;
- re-check narrative continuity after edits so the deck still reads as one presentation.

## Deliver the artifact

Use the host environment's native presentation or artifact capability when one is available. Follow any runtime-specific creation, persistence, revision, or export rules supplied by that environment.

Do not assume HTML, a particular filesystem location, or a particular presentation file format. When the host can create a downloadable or editable presentation artifact, return that artifact naturally. If it cannot, provide slide-ready structured content that preserves the intended narrative and hierarchy.

## Example

User: Create a six-slide presentation for leadership explaining why this rollout should move from a big-bang launch to staged adoption.

Result: Build a short decision-oriented deck with the current risk, staged alternative, comparison, rollout sequence, success measures, and recommendation rather than copying the source memo into six text-heavy slides.
