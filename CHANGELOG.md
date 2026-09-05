# Changelog

All notable changes to this repository will be documented in this file.

This changelog uses an `Unreleased` section for in-flight work and grouped headings inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the release note format used in [pi-mono](https://github.com/badlogic/pi-mono/blob/084aa2b54d1131c63774133a6a4197be35ba94c3/packages/coding-agent/CHANGELOG.md).

Versioned sections should match the Git tags and GitHub releases published for this repository.

## [Unreleased]

### New integrations

- Added opt-in macOS desktop computer use through the managed upstream `pi-computer-use` package, disabled in normal Pi sessions. ([#464](https://github.com/ladislas/mypac/issues/464))

### Dependencies

- Upgrade the pinned Headroom runtime from 0.36.5 to 0.37.0 ([#461](https://github.com/ladislas/mypac/issues/461)).
- Upgrade the tested Pi package contract from 0.84.3 to 0.85.0 ([#459](https://github.com/ladislas/mypac/issues/459)).

## [1.0.0] - 2026-09-03

### Added

- Added a canonical runtime-neutral `pac-slidedeck` presentation-design skill, consumed by the Pi slidedeck extension and exported as the fifth ChatGPT Agent Skill. ([#452](https://github.com/ladislas/mypac/issues/452))
- Added a first-class mise task that installs checkout dependencies and builds and validates upload-ready ChatGPT Agent Skills packages. ([#451](https://github.com/ladislas/mypac/issues/451))
- Added deterministic ChatGPT Agent Skills exports for `pac-deep-read`, `pac-grill-me`, `pac-zoom-out`, and `pac-explore`, with fail-closed portability validation and uploadable per-skill archives. ([#447](https://github.com/ladislas/mypac/issues/447))
- Added explicit-only `/pac-session-review` with metadata-first discovery, bounded selected-session events, current-artifact verification, and #411 ownership routing while keeping `/session-breakdown` aggregate-only. ([#82](https://github.com/ladislas/mypac/issues/82))
- Added targeted Pi bash-result compaction for successful `npm run check:pi-compatibility` runs, preserving failures, warnings, and retrievable full output. ([#395](https://github.com/ladislas/mypac/issues/395))
- Added a deterministic repository-edit evaluation scenario, fixed two-profile smoke matrix, strict external verifier, and complete maintainer workflow documentation. ([#380](https://github.com/ladislas/mypac/issues/380))
- Added schema-versioned canonical evaluation results and deterministic self-contained HTML comparison reports with offline regeneration, partial-evidence warnings, and lightweight human-review placeholders. ([#379](https://github.com/ladislas/mypac/issues/379))
- Added a manifest-driven local Pi evaluation runner with dry-run matrix previews, disposable repository clones, fresh pinned-configuration sessions, external verification, and retained normalized evidence. ([#377](https://github.com/ladislas/mypac/issues/377))
- Added Codex subscription-backed web search with source citations through the pinned `pi-codex-search` Pi package. ([#319](https://github.com/ladislas/mypac/issues/319))
- Added pinned bootstrap and sync workflows for mypac's global CLI tools, Pi packages, browser payload, and default screenshot directory. ([#352](https://github.com/ladislas/mypac/issues/352))
- Added a single clean-install Pi compatibility gate covering effective dependency versions, typechecking, and the complete behavior suite. ([#330](https://github.com/ladislas/mypac/issues/330))
- Added a clean package-consumer fixture covering peer installation, resource discovery and reload, project trust, malformed-resource isolation, prompt composition, dynamic tools, and recoverable guards. ([#329](https://github.com/ladislas/mypac/issues/329))
- Added hermetic routing coverage proving Answer and BTW preserve Pi API-key, OAuth, Headroom, scoped-model, custom-provider, cancellation, and teardown behavior. ([#327](https://github.com/ladislas/mypac/issues/327))
- Added a `/headroom` Pi extension for routing supported providers through a managed or externally detected Headroom proxy.
- Added cost-focused `/session-breakdown` stats with a compact colorized default report, trend insights, model/directory cost bars, an outlier diagnostic summary, top-5 session/model/directory drill-downs, worktree-aware directory grouping, and cache/context metrics when available. ([#280](https://github.com/ladislas/mypac/issues/280))
- Added a `/persona` Pi extension and `personas/` prompt-content directory for enabling reusable runtime personas, starting with the preserved Rick persona. ([#37](https://github.com/ladislas/mypac/issues/37))
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

- Retired completed Phase 1/2 model-comparison campaign fixtures after confirming the generic `pac-eval` harness already owns their reusable execution, configuration, matrix, and reporting invariants. ([#391](https://github.com/ladislas/mypac/issues/391))

- Removed the unused `/commit` extension; `pac-commit` remains the canonical commit workflow. ([#347](https://github.com/ladislas/mypac/issues/347))
- Removed OpenSpec prompts, skills, docs, and artifacts in favor of the GitHub-native planning workflow, and kept `/pac-explore` as a non-OpenSpec discovery mode. ([#216](https://github.com/ladislas/mypac/issues/216))

### Fixed

- Completed the phased runtime-environment closure by preflighting Pi before application sync, enforcing bundled npm installation ownership behaviorally, and correcting phase-safe sync and Headroom documentation. ([#430](https://github.com/ladislas/mypac/issues/430))
- Stabilized pac-eval timeout telemetry coverage by synchronizing timeout delivery after the fake child writes its partial session. ([#440](https://github.com/ladislas/mypac/issues/440))
- Prevented resumed `/pac-lwot` workflows from drifting beyond their authoritative target by re-grounding before implementation and checking target-to-slice closure before commit preparation. ([#438](https://github.com/ladislas/mypac/issues/438))
- Made `pac-commit` put `Closes #N` in completing issue-backed commit bodies and `Refs #N` in partial or supporting commits, independently of PR-body generation. ([#426](https://github.com/ladislas/mypac/issues/426))
- Prevented commits containing literal `\\n` text with a repository-local hk `commit-msg` check while preserving genuine multiline messages. ([#425](https://github.com/ladislas/mypac/issues/425))
- Made clean-room bootstrap install pinned `uv` before pipx-backed checkout tools. ([#423](https://github.com/ladislas/mypac/issues/423))
- Made `pac-review` keep its default defect and safety rubric concise while loading fix-session guidance conditionally and gathering explicit Standards + Spec context by changed-path applicability. ([#371](https://github.com/ladislas/mypac/issues/371))

- Made `pac-triage` gather issue context progressively by requested action while preserving deep bug-readiness, needs-info, durable-decision, and scope-precedent branches. ([#368](https://github.com/ladislas/mypac/issues/368))
- Made `/pac-lwot` reuse complete structured GitHub issue reads across target resolution and execution gating instead of re-fetching body or state metadata. ([#405](https://github.com/ladislas/mypac/issues/405))
- Made `/pac-upstream-checkpoints` resolve named registry scopes by stable ID before loading full registry, model, watch, or publication context. ([#373](https://github.com/ladislas/mypac/issues/373))
- Strengthened `/pac-llat` so complete structured GitHub reads classify directly and duplicate body/metadata fetches are explicitly forbidden. ([#397](https://github.com/ladislas/mypac/issues/397))
- Improved minimal and low thinking-level contrast across all bundled themes. ([#331](https://github.com/ladislas/mypac/issues/331))
- Made the current fullscreen transcript-search match visually distinct across all bundled themes. ([#331](https://github.com/ladislas/mypac/issues/331))
- Corrected Footer and Session Breakdown accounting for Pi 0.84.2 tool, summary, cache, response-model, adjustment, and v4 usage-ledger metadata without duplicate totals. ([#328](https://github.com/ladislas/mypac/issues/328))
- Restored Pi 0.84.2 fullscreen compatibility for transcript search, file reveal, maximum-thinking footer colors, and bundled themes. ([#325](https://github.com/ladislas/mypac/issues/325))
- Made project review guidelines respect Pi trust decisions and Pi-owned configuration paths honor default and overridden agent roots without moving mypac todo data. ([#323](https://github.com/ladislas/mypac/issues/323))
- Made extension UI mode-safe across TUI, RPC, JSON, and print execution while preserving RPC dialogs and notifications. ([#322](https://github.com/ladislas/mypac/issues/322))
- Fixed Headroom footer savings to show current Pi-session deltas instead of proxy-global totals. ([#309](https://github.com/ladislas/mypac/issues/309))
- Extended Headroom proxy startup waiting and surfaced elapsed startup progress in the `/headroom wrap` status indicator.

### Changed

- Added pinned mise-managed GitHub CLI and prebuilt Worktrunk applications with executable-ownership checks, a non-destructive Worktrunk smoke test, and fresh-shell setup documentation. ([#432](https://github.com/ladislas/mypac/issues/432))
- Phased bootstrap around mise-managed Node 24 LTS (including bundled npm) and uv foundation tools, with pre-mutation mise integration checks and explicit Pi runtime compatibility verification. ([#431](https://github.com/ladislas/mypac/issues/431))
- Split `pac-commit` fixup and history-rewrite guidance into an on-demand reference while retaining normal atomic-commit safety in the core skill. ([#370](https://github.com/ladislas/mypac/issues/370))
- Made `pac-pi-extension` verify pinned Pi APIs through targeted installed documentation sections and examples before broad fallback reads. ([#365](https://github.com/ladislas/mypac/issues/365))
- Audited all 24 skill invocation modes, locked the model-visible and workflow-only sets in regression coverage, and narrowed `pac-improve-architecture` to explicit architecture requests. ([#367](https://github.com/ladislas/mypac/issues/367))
- Gated `/pac-lwot` execution before repository preparation so completed targets stop without loading implementation or commit context. ([#361](https://github.com/ladislas/mypac/issues/361))
- Preferred structured GitHub and repository tooling over browser automation when direct APIs or local data provide the required information. ([#362](https://github.com/ladislas/mypac/issues/362))
- Made `/pac-llat` a progressive-context router and kept workflow-only planning skills out of automatic model context. ([#359](https://github.com/ladislas/mypac/issues/359))
- Avoided redundant structured GitHub issue reads during `/pac-llat` classification while preserving necessary follow-up verification. ([#393](https://github.com/ladislas/mypac/issues/393))
- Upgraded the pinned Headroom installation to 0.36.5.
- Made safe Git execution hygiene—branch checks, atomic slice commits, unrelated-change isolation, and explicit authorization for history operations—the default for natural-language implementation. ([#349](https://github.com/ladislas/mypac/issues/349))
- Upgraded development and peer dependency baseline to Pi 0.84.3, adopting session-scoped model defaults for Headroom routing refreshes and BTW side-session model synchronization. ([#345](https://github.com/ladislas/mypac/issues/345))
- Made `/context` use Pi's structured system-prompt inputs for context-file attribution, including overrides, nested projects, worktrees, and reloaded resources. ([#324](https://github.com/ladislas/mypac/issues/324))
- Upgraded the development and peer dependency baseline to Pi 0.84.2, migrating Answer model completion and BTW child runtimes to the canonical model runtime APIs. ([#321](https://github.com/ladislas/mypac/issues/321))
- Streamlined the README around package discovery and first use, moving the complete asset catalog and contributor/integration reference material into dedicated documentation. ([#303](https://github.com/ladislas/mypac/issues/303))
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
