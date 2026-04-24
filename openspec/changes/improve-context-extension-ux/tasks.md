## 1. Extension preparation and safe layout

- [x] 1.1 Re-read `skills/pi-extension/SKILL.md` and inspect the installed Pi docs/examples needed to confirm the current extension import and testing patterns.
- [x] 1.2 Move `/context` from `extensions/context.ts` to `extensions/context/index.ts`, extract sibling helper modules inside `extensions/context/`, and remove the old top-level file so no non-entrypoint `.ts`/`.js` helpers remain directly under `extensions/`.
- [x] 1.3 Add colocated tests under `extensions/context/` for the extracted usage, labeling, and rendering helpers.

## 2. `/context` UX improvements

- [x] 2.1 Update TUI and plain-text output to separate overall context-window usage from the used-token breakdown so small system/tool segments remain legible.
- [x] 2.2 Replace the ambiguous `AGENTS` wording with distinct labels for system-prompt contribution versus discovered agent files.
- [x] 2.3 Show approximate token counts for loaded skills while keeping unloaded skills clearly non-active.

## 3. Verification

- [ ] 3.1 Run `npm test` and fix any regressions caused by the `/context` refactor and UX changes.
- [ ] 3.2 Run `npm run typecheck` and verify the final `extensions/context/` layout still follows the repository's Pi extension safety rules.
