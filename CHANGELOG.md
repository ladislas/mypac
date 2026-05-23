# Changelog

All notable changes to this repository will be documented in this file.

This changelog uses an `Unreleased` section for in-flight work and grouped headings inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the release note format used in [pi-mono](https://github.com/badlogic/pi-mono/blob/084aa2b54d1131c63774133a6a4197be35ba94c3/packages/coding-agent/CHANGELOG.md).

Versioned sections should match the Git tags and GitHub releases published for this repository.

## [Unreleased]

### Added

- Added a repo-local Worktrunk extension with `/worktree issue <issue-number-or-url>`, issue-derived branch names, create-or-reuse behavior, Worktrunk `pre-start` setup hooks, and workflow documentation for parallel Pi issue work. ([#85](https://github.com/ladislas/mypac/issues/85))
- Added non-issue Worktrunk shortcuts for explicit branch worktrees, listing worktrees, and showing current worktree status from Pi. ([#270](https://github.com/ladislas/mypac/issues/270))
- Added a custom Pi footer extension with write-cache token totals, provider-qualified model labels, context/budget threshold coloring, Codex/Copilot/Claude usage bars, and no default auto-compaction percentage segment. ([#265](https://github.com/ladislas/mypac/issues/265))
- Added hooks that block `fixup!` commits from being merged or pushed into `main` through the local workflow. ([#259](https://github.com/ladislas/mypac/issues/259))
- Added optional Standards + Spec follow-up review support with a dedicated `pac-review-standards-spec` skill and `/review-end` summaries that preserve default, standards, and spec findings separately. ([#255](https://github.com/ladislas/mypac/issues/255))
- Added `/pac-fix-copilot-review` for addressing GitHub Copilot PR review comments with explicit fixup commits and resolved review threads. ([#246](https://github.com/ladislas/mypac/issues/246))
- Added a `notify` Pi extension that sends terminal notifications with the latest assistant response summary when Pi is ready for input, using terminal-specific OSC sequences with OSC 777 as the fallback. ([#236](https://github.com/ladislas/mypac/issues/236))
- Added `.pac/upstream-sources.yaml`, `pac-upstream-checkpoints`, and `/pac-upstream-checkpoints` for reviewing borrowed upstream sources, tracking local artifacts, and creating checkpoint issues. ([#192](https://github.com/ladislas/mypac/issues/192))
- Added `pac-tdd` as a standalone pragmatic TDD skill with lightweight notes for tests, mocking, refactoring, deep modules, and interface design. ([#155](https://github.com/ladislas/mypac/issues/155))
- Added this changelog to track notable repository changes and future GitHub releases. ([#139](https://github.com/ladislas/mypac/issues/139))
- Added a `/pac-slidedeck` extension command and `save_slidedeck` tool that generate presentation-style HTML decks under `~/.pi/agent/slidedecks/` instead of the repo workspace. ([#131](https://github.com/ladislas/mypac/issues/131))
- Added `pac-grill-with-docs`, its thin `/pac-grill-with-docs` prompt, and an initial repo-root `CONTEXT.md` to support GitHub-first grilling, issue-backed ADR comments, and sparing local context updates. ([#157](https://github.com/ladislas/mypac/issues/157))
- Added the GitHub-native PRD-to-issues workflow pieces, including `pac-to-prd`, `pac-to-issues`, and their slash-command docs. ([#142](https://github.com/ladislas/mypac/issues/142))
- Added `pac-improve-architecture`, its thin `/pac-improve-architecture` prompt, and adapted deepening guidance files for issue-aware architecture review without GitHub write-back or automatic `CONTEXT.md` edits. ([#177](https://github.com/ladislas/mypac/issues/177))
- Added `pac-diagnose`, its thin `/pac-diagnose` prompt, and a HITL reproduction-loop template for disciplined bug and performance-regression diagnosis. ([#194](https://github.com/ladislas/mypac/issues/194))
- Added `/pac-zoom-out` as a lightweight prompt for mapping a code area without creating a full skill. ([#195](https://github.com/ladislas/mypac/issues/195))
- Added `pac-triage`, its thin `/pac-triage` prompt, durable agent-brief guidance, GitHub-first wontfix handling, and `out of scope` scope-boundary comments. ([#196](https://github.com/ladislas/mypac/issues/196))
- Added `/pac-setup-workflows` to check and explicitly apply canonical `pac:*` GitHub workflow labels, including legacy label migration planning. ([#199](https://github.com/ladislas/mypac/issues/199))
- Added a `pac-setup-workflows` shell CLI that reuses the canonical label setup core for terminal checks and explicitly confirmed applies. ([#205](https://github.com/ladislas/mypac/issues/205))
- Added a pac label-health GitHub Actions workflow that maintains one managed warning comment for conflicting or drifted issue workflow labels. ([#203](https://github.com/ladislas/mypac/issues/203))

### Removed

- Removed OpenSpec prompts, skills, docs, and artifacts in favor of the GitHub-native planning workflow, and kept `/pac-explore` as a non-OpenSpec discovery mode. ([#216](https://github.com/ladislas/mypac/issues/216))

### Changed

- Promoted `/pac-zoom-out` to a standalone lightweight `pac-zoom-out` skill for mapping unfamiliar code areas. ([#241](https://github.com/ladislas/mypac/issues/241))
- Improved `/worktree issue` feedback with progress notifications, a prominent next-command code block, and a suggested `pi` launch prompt that starts `/pac-lwot` for the issue. ([#272](https://github.com/ladislas/mypac/issues/272))
- Taught implementation-oriented prompts to load `pac-tdd` selectively for behavior-changing work, bug fixes, and regression coverage. ([#210](https://github.com/ladislas/mypac/issues/210))
- Preserved full-history `pac-librarian` checkouts during refreshes so upstream checkpoint range reviews are not re-shallowed after unshallowing. ([#232](https://github.com/ladislas/mypac/issues/232))
- Taught `/ghi` issue creation to infer existing pac workflow state labels and warn users to run `/pac-setup-workflows` when expected labels are missing. ([#202](https://github.com/ladislas/mypac/issues/202))
- Aligned label-dependent workflows on canonical `pac:*` labels and `/pac-setup-workflows` warnings instead of legacy label fallbacks. ([#199](https://github.com/ladislas/mypac/issues/199))
- Added one-off optional custom instruction prompts to `/review-start` selector runs and `/review-end` summarize/fix flows, with Enter-to-skip and Esc-to-cancel behavior while keeping `--extra` and shared review instructions unchanged. ([#115](https://github.com/ladislas/mypac/issues/115))
- Taught `/pac-lwot` to treat linked `## PRDs` and `## Decisions` issue artifacts as first-class planning context, prefer the latest linked PRD iteration, and report which artifacts informed its plan. ([#164](https://github.com/ladislas/mypac/issues/164))
- Renamed `/review` to `/review-start` and `/end-review` to `/review-end` for a consistent review command pair. ([#108](https://github.com/ladislas/mypac/issues/108))
- Added a repo-local skill for updating `CHANGELOG.md` during normal agent-driven work and preparing release sections on request. ([#139](https://github.com/ladislas/mypac/issues/139))
- Refined the `/pac-slidedeck` workflow so saved-deck replies include a clickable Markdown link and the shared scaffold now follows the preferred issue #85 deck styling more closely. ([#131](https://github.com/ladislas/mypac/issues/131))
- Strengthened the repo-local authoring guidance for skills, prompts, and extensions, and aligned the GitHub-native prompt and commit extension follow-up changes to that guidance. ([#144](https://github.com/ladislas/mypac/issues/144))
- Renamed `/btw` sidecar sessions to sidechats and switched BTW persistence to the new `.btw-sidechats` / `btw-sidechat-state` names, which stops reusing older BTW saved state. ([#114](https://github.com/ladislas/mypac/issues/114))
- Improved the `save_slidedeck` tool with an optional per-slide `eyebrow` field, 6 new CSS layout classes (`.stat`, `.badge`, `.section`, `.statement`, `.quote`, `.steps`), a rewritten prompt cheat sheet with one HTML snippet per pattern, and several rendering bug fixes (badge wrapping, steps layout, footer/nav alignment, `.badge.progress` class collision, mobile viewport layout, duplicate headings in cheat-sheet examples). ([#150](https://github.com/ladislas/mypac/issues/150))
- Hardened the `/pac-slidedeck` refinement workflow: separated creation (uses `save_slidedeck` once) from refinement (strict copy-first flow to the next `-vN` file); added runtime guardrails that block `write`, multi-file edits, and shell mutation beyond a validated single-file `cp`; allowed `edit`, `edit.multi`, and single-file `edit.patch` against the pending copied file only; and extended session state to track both current deck and pending refinement target across session reconstruction. ([#173](https://github.com/ladislas/mypac/issues/173))
- Added `pac-grill-me` and `pac-caveman` skills and thin prompts, adapted from mattpocock/skills. `/pac-grill-me [topic]` enters relentless one-question-at-a-time interview mode; `/pac-caveman` enters ultra-compressed communication mode (~75% token reduction). ([#158](https://github.com/ladislas/mypac/issues/158))
