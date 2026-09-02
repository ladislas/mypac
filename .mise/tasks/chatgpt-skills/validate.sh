#!/usr/bin/env bash
#MISE description="Validate exported ChatGPT Agent Skills with the pinned reference validator"
#MISE depends=["deps"]
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd -P)"
cd "$root"

npm run validate:chatgpt-skills:reference
