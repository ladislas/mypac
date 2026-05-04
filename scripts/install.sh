#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing Node dependencies"
npm ci

echo "==> Trusting repo mise configuration"
mise trust

echo "==> Installing repo-managed tools"
mise install

echo "==> Installing git hooks"
mise run hooks

echo "==> Done"
echo "If Pi is already running, use /reload or restart Pi."
