#!/usr/bin/env bash
set -euo pipefail

repeated_headings=$(cat <<'MARKDOWN'
# Changelog

## [Unreleased]

### Added

- New addition

### Changed

- New change

### Fixed

- New fix

## [1.0.0] - 2026-09-03

### Added

- Old addition

### Changed

- Old change

### Fixed

- Old fix
MARKDOWN
)

if ! printf '%s\n' "$repeated_headings" | markdownlint-cli2 - >/dev/null 2>&1; then
  echo 'markdownlint must accept repeated release subsection headings' >&2
  exit 1
fi

sibling_duplicate=$(cat <<'MARKDOWN'
# Changelog

## [Unreleased]

### Added

- First addition

### Added

- Second addition
MARKDOWN
)

if output=$(printf '%s\n' "$sibling_duplicate" | markdownlint-cli2 - 2>&1); then
  echo 'markdownlint must reject duplicate sibling headings' >&2
  exit 1
fi

if ! grep -q 'MD024/no-duplicate-heading' <<<"$output"; then
  echo "markdownlint must reject duplicate sibling headings with MD024: $output" >&2
  exit 1
fi
