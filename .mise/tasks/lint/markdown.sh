#!/usr/bin/env bash
#MISE description="Lint Markdown files"
set -euo pipefail

existing_files=()
while IFS= read -r file; do
  if [[ -f "$file" ]]; then
    existing_files+=("$file")
  fi
done < <(git ls-files '*.md')

if ((${#existing_files[@]} == 0)); then
  exit 0
fi

markdownlint-cli2 "${existing_files[@]}"
bash scripts/check-markdownlint-changelog.sh
