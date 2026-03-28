#!/usr/bin/env bash
#MISE description="Validate additive layering with project-local .opencode assets"
set -euo pipefail

repo_root="${MISE_PROJECT_ROOT:-$(git rev-parse --show-toplevel)}"
tmpdir="$(mktemp -d)"
project_dir="$tmpdir/opencode-layering-fixture"
trap 'rm -rf "$tmpdir"' EXIT

mkdir -p "$project_dir/.opencode/agents" "$project_dir/.opencode/commands" "$project_dir/.opencode/skills/local-overlay-skill"

cat <<'EOF' >"$project_dir/.opencode/agents/LocalOverlay.md"
---
description: Local overlay validation agent
mode: primary
---

# Local overlay agent

This agent exists only to prove additive layering works.
EOF

cat <<'EOF' >"$project_dir/.opencode/commands/local-overlay.md"
---
description: Local overlay validation command
---

This command exists only to prove additive layering works.
EOF

cat <<'EOF' >"$project_dir/.opencode/skills/local-overlay-skill/SKILL.md"
---
name: local-overlay-skill
description: Local overlay validation skill
---

## Purpose

This skill exists only to prove additive layering works.
EOF

(cd "$project_dir" && OPENCODE_CONFIG_DIR="$repo_root" opencode agent list >"$tmpdir/agents.txt")
(cd "$project_dir" && OPENCODE_CONFIG_DIR="$repo_root" opencode debug skill >"$tmpdir/skills.json")
(cd "$project_dir" && OPENCODE_CONFIG_DIR="$repo_root" opencode debug config >"$tmpdir/config.json")

rg -q '^RickBuild\b' "$tmpdir/agents.txt"
rg -q '^RickPlan\b' "$tmpdir/agents.txt"
rg -q '^LocalOverlay\b' "$tmpdir/agents.txt"

rg -q '"name": "pac-openspec-apply-change"' "$tmpdir/skills.json"
rg -q '"location": ".*/skills/pac-openspec-apply-change/SKILL.md"' "$tmpdir/skills.json"
rg -q '"name": "local-overlay-skill"' "$tmpdir/skills.json"
rg -q '"location": ".*/\.opencode/skills/local-overlay-skill/SKILL.md"' "$tmpdir/skills.json"

rg -q '"pac-apply"' "$tmpdir/config.json"
rg -q '"local-overlay"' "$tmpdir/config.json"

printf 'Validated additive shared-kit layering with local overlays.\n'
