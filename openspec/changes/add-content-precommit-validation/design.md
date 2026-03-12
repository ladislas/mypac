# Design

## Context

This repository stores workflow metadata and automation inputs in YAML and relies heavily on Markdown for prompts, OpenSpec artifacts, and durable documentation. Malformed YAML can break tooling, while inconsistent Markdown linting can quietly erode the quality of the repo's main knowledge surface. There is not yet a repository-level guard that catches either kind of issue before commit.

## Goals / Non-Goals

**Goals:**

- Add a consistent pre-commit validation step for YAML files and Markdown files in this repository.
- Use a lightweight, standard hook configuration that is easy for contributors to install and understand.
- Use `mise` as the repo-managed way to install `pre-commit` without requiring separate runtime setup.
- Ensure hook failures point developers to the specific invalid or non-compliant file before changes are committed.

**Non-Goals:**

- Enforce full YAML style normalization beyond syntax and structural validity.
- Introduce broader linting for non-YAML, non-Markdown files as part of this change.
- Replace contributor documentation outside the minimum guidance needed to use the hook.

## Decisions

- Use the `pre-commit` framework as the repository-managed hook runner.
  - This is simpler and more portable than maintaining a custom `.git/hooks/pre-commit` script, and it keeps hook behavior versioned in the repository.
  - Alternative considered: a raw git hook script committed to the repo. Rejected because git does not automatically install tracked hooks, making adoption less reliable.
- Use `mise` to install `pre-commit`, with contributor setup documented as `brew install mise`, `mise install`, then `mise x -- pre-commit install`.
  - This keeps the repository's tool bootstrap consistent with the user's preferred workflow and avoids asking contributors to install `pre-commit` directly with pip or to manage Python manually.
  - Alternative considered: direct `brew install pre-commit`. Rejected because `mise` scales better as the repo adds more developer tools.
- Pin `pre-commit` in `mise.toml`, but let `pre-commit` manage hook runtimes for individual hooks.
  - This keeps the repo bootstrap small: contributors install one tool manager plus `pre-commit`, while hook-specific runtimes such as Node are provisioned by `pre-commit` as needed.
  - Alternative considered: also installing Node through `mise` for Markdown linting. Rejected for now because `markdownlint-cli2` already works well as a `pre-commit`-managed hook.
- Validate both `.yaml` and `.yml` files tracked by the repository.
  - This matches common YAML naming conventions and avoids gaps if future files use either extension.
  - Alternative considered: validating only known directories such as `openspec/`. Rejected because new YAML files could be added elsewhere and silently bypass checks.
- Lint Markdown with `markdownlint-cli2` across the repository, using a root config plus a scoped `.opencode` override.
  - The root `.markdownlint.yaml` keeps defaults on while disabling `MD013` and `MD060`, which lowers noise for long lines and fenced code blocks.
  - `.opencode/.markdownlint.yaml` extends the root config and disables `MD041` because `.opencode` prompt files commonly begin with front matter instead of a top-level heading.
  - Alternative considered: excluding `.opencode/` from Markdown linting. Rejected because those files are important repo assets and should still be linted with a narrower exception.
- Lint all repository Markdown in the first rollout and add exclusions only if the initial run proves too noisy.
  - This preserves learning value and keeps the first policy honest about what the repo actually contains.

## Risks / Trade-offs

- [Contributors do not install or activate `mise` / `pre-commit`] -> Mitigate by documenting the exact bootstrap commands and using `mise x -- pre-commit ...` so shell activation is optional.
- [Only local commits are protected] -> Mitigate by making the hook configuration deterministic so it can later be reused in CI if desired.
- [Markdown linting creates too much initial noise] -> Mitigate by starting with a relaxed ruleset, linting the whole repo once, and adding only surgical exclusions if specific paths prove too noisy.
- [YAML syntax passes but style remains inconsistent] -> Mitigate by treating this change as a correctness baseline and adding stricter YAML linting later only if it proves valuable.
