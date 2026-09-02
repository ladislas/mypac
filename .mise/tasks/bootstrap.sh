#!/usr/bin/env bash
#MISE description="Set up this checkout and reconcile the global Pi environment"
set -euo pipefail

if ! command -v mise >/dev/null 2>&1; then
	echo "Error: mise is required. Install it from https://mise.jdx.dev/getting-started.html" >&2
	exit 1
fi

mise_status="$(mise doctor --json 2>/dev/null || true)"
if ! grep -Eq '"(activated|shims_on_path)"[[:space:]]*:[[:space:]]*true' <<< "$mise_status"; then
	echo "Error: mise must be persistently available through shell activation or shims before bootstrapping." >&2
	echo "Configure activation: https://mise.jdx.dev/cli/activate.html" >&2
	echo "Or configure shims: https://mise.jdx.dev/dev-tools/shims.html" >&2
	exit 1
fi

root="$(cd "$(dirname "$0")/../.." && pwd -P)"
sync="$root/.mise/tasks/sync.sh"
cd "$root"

"$sync" validate
"$sync" foundation
mise_environment="$(mise env -s bash)"
eval "$mise_environment"

if ! command -v pi >/dev/null 2>&1; then
	echo "Error: Pi is required. Install it before bootstrapping mypac: https://github.com/earendil-works/pi" >&2
	exit 1
fi
installed_pi_version="$(pi --version)"
tested_pi_version="$(sed -n 's/.*"@earendil-works\/pi-coding-agent"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -1)"
printf 'Installed Pi: %s\nmypac tested Pi: %s\n' "$installed_pi_version" "$tested_pi_version"

mise run deps
mise install
mise run hooks
"$sync" application
"$sync" pi
"$sync" setup
"$sync" verify
