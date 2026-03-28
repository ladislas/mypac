#!/usr/bin/env bash
#MISE description="Validate root-level OpenCode shared-kit discovery"
set -euo pipefail

repo_root="${MISE_PROJECT_ROOT:-$(git rev-parse --show-toplevel)}"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

OPENCODE_CONFIG_DIR="$repo_root" opencode agent list >"$tmpdir/agents.txt"
OPENCODE_CONFIG_DIR="$repo_root" opencode debug skill >"$tmpdir/skills.json"
OPENCODE_CONFIG_DIR="$repo_root" opencode debug config >"$tmpdir/config.json"

rg -q '^RickBuild\b' "$tmpdir/agents.txt"
rg -q '^RickPlan\b' "$tmpdir/agents.txt"

rg -q '"location": ".*/skills/pac-bootstrap-placeholder/SKILL.md"' "$tmpdir/skills.json"
rg -q '"name": "pac-openspec-apply-change"' "$tmpdir/skills.json"
rg -q '"name": "pac-openspec-propose"' "$tmpdir/skills.json"
rg -q '"name": "pac-openspec-explore"' "$tmpdir/skills.json"
rg -q '"name": "pac-openspec-archive-change"' "$tmpdir/skills.json"

rg -q '"pac-apply"' "$tmpdir/config.json"
rg -q '"pac-propose"' "$tmpdir/config.json"
rg -q '"pac-explore"' "$tmpdir/config.json"
rg -q '"pac-archive"' "$tmpdir/config.json"
rg -q '"add-task"' "$tmpdir/config.json"
rg -q '"commit"' "$tmpdir/config.json"
rg -q '"merge"' "$tmpdir/config.json"

printf 'Validated root-level shared-kit discovery.\n'
