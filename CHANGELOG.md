# Changelog

All notable changes to this repository will be documented in this file.

This changelog uses an `Unreleased` section for in-flight work and grouped headings inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the release note format used in [pi-mono](https://github.com/badlogic/pi-mono/blob/084aa2b54d1131c63774133a6a4197be35ba94c3/packages/coding-agent/CHANGELOG.md).

Versioned sections should match the Git tags and GitHub releases published for this repository.

## [Unreleased]

### Added

- Added this changelog to track notable repository changes and future GitHub releases. ([#139](https://github.com/ladislas/mypac/issues/139))
- Added a `/pac-slidedeck` extension command and `save_slidedeck` tool that generate presentation-style HTML decks under `~/.pi/agent/slidedecks/` instead of the repo workspace. ([#131](https://github.com/ladislas/mypac/issues/131))

### Changed

- Added a repo-local skill for updating `CHANGELOG.md` during normal agent-driven work and preparing release sections on request. ([#139](https://github.com/ladislas/mypac/issues/139))
- Refined the `/pac-slidedeck` workflow so saved-deck replies include a clickable Markdown link and the shared scaffold now follows the preferred issue #85 deck styling more closely. ([#131](https://github.com/ladislas/mypac/issues/131))
- Strengthened the repo-local authoring guidance for skills, prompts, and extensions, and aligned the non-OpenSpec prompt and commit extension follow-up changes to that guidance. ([#144](https://github.com/ladislas/mypac/issues/144))
- Renamed `/btw` sidecar sessions to sidechats and switched BTW persistence to the new `.btw-sidechats` / `btw-sidechat-state` names, which stops reusing older BTW saved state. ([#114](https://github.com/ladislas/mypac/issues/114))
