#!/usr/bin/env bash
#MISE description="Reconcile checkout-local Node dependencies"
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd -P)"
cd "$root"

npm ci
