# Changelog

All notable changes to this repository will be documented in this file.

This changelog uses an `Unreleased` section for in-flight work and grouped headings inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the release note format used in [pi-mono](https://github.com/badlogic/pi-mono/blob/084aa2b54d1131c63774133a6a4197be35ba94c3/packages/coding-agent/CHANGELOG.md).

Versioned sections should match the Git tags and GitHub releases published for this repository.

## [Unreleased]

### Added

- Added this changelog to track notable repository changes and future GitHub releases. ([#139](https://github.com/ladislas/mypac/issues/139))

### Changed

- Added a repo-local skill for updating `CHANGELOG.md` during normal agent-driven work and preparing release sections on request. ([#139](https://github.com/ladislas/mypac/issues/139))
- Renamed `/btw` sidecar sessions to sidechats and switched BTW persistence to the new `.btw-sidechats` / `btw-sidechat-state` names, which stops reusing older BTW saved state. ([#114](https://github.com/ladislas/mypac/issues/114))
