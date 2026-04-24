## Why

The `/context` command is useful for inspecting what Pi has loaded, but its current presentation makes the most important information hard to read. The single full-window bar hides small system/tool segments, the `AGENTS` label is ambiguous, and active skills do not show any token footprint.

This change captures a focused, implementation-ready plan for issue #66 so the extension can become easier to read without expanding into unrelated prompt-file or workflow changes.

## What Changes

- Improve `/context` so context-window usage and used-token breakdown are both legible instead of relying on one misleading full-window bar.
- Relabel the current `AGENTS` output so system-prompt contribution and discovered agent files are clearly distinct.
- Show token estimates for active skills in the `/context` view.
- Refactor the extension into a dedicated `extensions/context/` directory with modularized helpers and colocated tests, following the repository's Pi extension safety rules.
- Keep file renames such as `shared/AGENTS.md` out of scope for this change.

## Capabilities

### New Capabilities

- `context-command-overview`: Clear, readable `/context` output that distinguishes total window usage, used-token breakdown, agent-file sources, and active skill token estimates.

### Modified Capabilities

- None.

## Impact

- Affected code: the current `/context` extension in `extensions/context.ts`, which will move into `extensions/context/` with supporting modules and tests.
- Affected behavior: TUI and plain-text `/context` output, including labels, bars, and skill reporting.
- Verification impact: add colocated tests for the extracted rendering/estimation helpers and run the repository test/typecheck commands required for extension work.
- Non-goals: renaming prompt files, changing how Pi loads AGENTS files, or broadening `/context` beyond the issue #66 UX improvements.
