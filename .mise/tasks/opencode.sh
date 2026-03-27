#!/usr/bin/env bash
#MISE description="Launch OpenCode with this repo as OPENCODE_CONFIG_DIR"
set -euo pipefail

repo_root="${MISE_PROJECT_ROOT:-$(git rev-parse --show-toplevel)}"
export OPENCODE_CONFIG_DIR="$repo_root"

if (($# == 0)); then
  exec opencode "$repo_root"
fi

exec opencode "$@"
