## Context

`/context` currently lives in a single top-level file at `extensions/context.ts`. That layout is acceptable only while the extension stays trivial, but issue #66 now bundles several non-trivial presentation changes: clearer usage breakdowns, disambiguated agent labels, and per-skill token reporting. Per the repository's `pi-extension` skill, any multi-file refactor must move the extension into `extensions/context/` so helpers and tests are not accidentally auto-discovered as separate extensions.

The existing implementation already has most of the raw data needed: message/context-window estimates, agent file discovery, loaded-skill tracking, and a non-UI plain-text fallback. The main gap is presentation. A single full-window bar makes tiny system/tool segments unreadable, `AGENTS` refers to two different concepts, and loaded skills are highlighted without quantifying their cost.

## Goals / Non-Goals

**Goals:**

- Make `/context` readable when the context window is mostly free by separating total window usage from used-token composition.
- Distinguish system-prompt contribution from discovered agent files in both TUI and plain-text output.
- Show approximate token counts for loaded skills.
- Refactor the extension into a safe multi-file layout under `extensions/context/` with colocated tests.
- Verify extension patterns against the installed Pi package/docs before implementation, as required by the `pi-extension` skill.

**Non-Goals:**

- Renaming repository prompt files such as `shared/AGENTS.md`.
- Changing how Pi discovers AGENTS/CLAUDE files or computes exact tokenizer-backed counts.
- Expanding `/context` into a broader session-inspection or optimization tool beyond the issue #66 UX improvements.

## Decisions

### 1. Convert `/context` to a directory-based extension before behavior changes

- Decision: move the entrypoint to `extensions/context/index.ts` and extract pure helpers/rendering utilities into sibling modules with colocated tests.
- Rationale: this follows the repository's extension safety rules and reduces the risk of accidentally placing helpers/tests at `extensions/` top level, where Pi would auto-load them as extensions.
- Alternatives considered:
  - Keep `extensions/context.ts` and append more logic there: rejected because the change is already large enough to benefit from modularization and tests.
  - Extract helpers to top-level `extensions/*.ts`: rejected because Pi auto-discovers those files as extension entrypoints.

### 2. Represent context usage with complementary summaries instead of a single scaled bar

- Decision: keep the existing total window usage summary, but add a separate used-token breakdown that excludes free space so system/tools/conversation proportions stay legible.
- Rationale: the issue is caused by scaling every category against the full context window. A used-only breakdown directly addresses that failure mode without removing the existing total-usage framing.
- Alternatives considered:
  - Keep only the current full-window bar and tweak colors: rejected because visibility fails due to scale, not color choice.
  - Replace all bars with text-only summaries: rejected because a compact visual breakdown is still useful in the TUI.

### 3. Use distinct labels for system-prompt contribution and agent files

- Decision: rename the system-side label to refer to agent-file contribution/context files, while reserving the list label for the discovered agent files themselves.
- Rationale: the user should be able to tell the difference between tokens attributed to content injected into the system prompt and the list of files that contributed that content.
- Alternatives considered:
  - Rename repository files such as `shared/AGENTS.md`: rejected as out of scope for this issue.
  - Leave the labels unchanged and rely on documentation: rejected because the ambiguity is in the live command output.

### 4. Estimate loaded-skill tokens from the skill source files already tracked by the extension

- Decision: reuse the extension's loaded-skill tracking and estimate each loaded skill's size from the corresponding skill files, surfacing approximate counts in the output.
- Rationale: the extension already knows which skills were actually loaded via read-tool events. Estimating from the skill files is consistent with the existing fuzzy token model and avoids introducing a heavier tokenizer dependency.
- Alternatives considered:
  - Show counts for all installed skills: rejected because the issue asks about active skills and unloaded skills do not contribute current prompt weight.
  - Attempt exact tokenization: rejected as unnecessary complexity for an approximate observability view.

## Risks / Trade-offs

- [Approximate counts may not match provider-reported token usage exactly] → Mitigate by continuing to label counts as approximate (`~`) and keeping the feature focused on relative visibility, not billing accuracy.
- [Refactoring file layout could break extension discovery] → Mitigate by using `extensions/context/index.ts` as the only entrypoint and colocating all helpers/tests inside that directory.
- [Additional UI lines could crowd narrow terminals] → Mitigate by favoring concise labels and extracting formatting helpers that can be tested against narrow-width output.

## Migration Plan

- Move the extension entrypoint from `extensions/context.ts` to `extensions/context/index.ts` in the same implementation slice that introduces the extracted helpers.
- Add colocated tests for the extracted logic before or alongside the refactor so the moved behavior stays verifiable.
- Run `npm test` and `npm run typecheck` after the refactor and UX updates.

## Open Questions

- None for the proposal stage; the implementation can stay within the narrow UX scope captured in issue #66.
