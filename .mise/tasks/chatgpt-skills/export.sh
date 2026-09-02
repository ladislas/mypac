#!/usr/bin/env bash
#MISE description="Export portable ChatGPT Agent Skills"
#MISE depends=["deps"]
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd -P)"
cd "$root"

npm run export:chatgpt-skills
