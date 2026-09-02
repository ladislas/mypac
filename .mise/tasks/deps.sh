#!/usr/bin/env bash
#MISE description="Reconcile checkout-local Node dependencies"
#MISE sources=["package.json", "package-lock.json"]
#MISE outputs=["node_modules/.package-lock.json"]
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd -P)"
cd "$root"

npm ci
