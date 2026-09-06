# Local Pi evaluations

`pac-eval` runs every scenario/profile pair in a fresh Pi session and disposable Git clone. Generated data defaults to `~/.pi/agent/evals/<evaluation-id>/`; it must remain outside the target repository and invoking checkout.

## Manifest structure

Manifests are JSON validated against [`schemas/pac-eval-manifest.schema.json`](../schemas/pac-eval-manifest.schema.json). The maintained MVP example is [`evaluations/mvp-smoke/manifest.json`](../evaluations/mvp-smoke/manifest.json).

- `repository.path` and `repository.ref` select the target repository. The runner resolves the ref to one base SHA before launching children, so every run starts from equivalent state.
- `scenarios[]` defines an agent prompt, optional timeout, deterministic external verification commands, and files to retain as artifacts.
- `profiles[]` defines an exact `provider/model`, thinking level, and optional workflow, execution policy, or package variant.
- The matrix is the Cartesian product of scenarios and profiles.

Use the pinned Pi installation to check which configured models are genuinely available before choosing profiles:

```sh
node node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js --list-models
```

### Profile variants

A profile can vary one or more of these inputs:

- **Model/thinking:** set `model` to an exact `provider/model` ID and `thinking` to a supported Pi level.
- **Workflow:** set `workflow` (for example, `/pac-lwot`) to prepend that command to the scenario prompt.
- **Package/ref:** set `package.path` and `package.ref` to evaluate resources from a particular package commit. The package ref is resolved before child execution and cloned separately from the target repository.
- **Prompt:** add package-relative files or directories to `package.resources.prompts`.
- **Skill:** add package-relative skill files or directories to `package.resources.skills`.
- **Extension:** add explicit extension entrypoints to `package.resources.extensions`. Automatic extension discovery remains disabled.

Only listed package resources are loaded. This supports focused package, ref, workflow, prompt, skill, and extension comparisons without exposing the entire maintainer environment.

## Execution policies

The default restricted policy gives a child only `read`, `edit`, `write`, `grep`, `find`, and `ls`. It is suitable for narrow repository edits such as the MVP smoke scenario.

Trusted implementation evaluations may opt into an explicit built-in tool allowlist:

```json
{
  "execution": {
    "tools": ["read", "bash", "edit", "write", "grep", "find", "ls"]
  }
}
```

Treat elevated tools and selected package resources as explicit trusted-evaluation policy, not defaults. Every child receives a disposable `HOME`, Pi config directory, repository clone, and fresh session directory. The runner copies only Pi authentication/model-catalog files needed for model access, strips common publication credentials, removes Git remotes, and never pushes, publishes, merges, or calls GitHub. Verification commands are trusted manifest input and run directly without a shell.

## Dry-run and execution

Preview the resolved matrix without a model call:

```sh
npm run eval -- evaluations/mvp-smoke/manifest.json --dry-run
```

Confirm the printed scenarios, profiles, requested model/thinking values, tools, and `totalRuns` before execution. Then run the same manifest:

```sh
npm run eval -- evaluations/mvp-smoke/manifest.json
```

The execution plan is printed before launch. Each child run retains normalized status, resolved refs/SHAs, requested and actual configuration, available telemetry, external-verification results, git status/diff/commits, stdout/stderr, session metadata, timing, and requested artifacts. `diff.patch` is the authoritative final-change artifact: it compares the resolved evaluation base SHA with the final working tree, so it includes committed, staged, unstaged, and non-ignored untracked changes. `commits.txt` is optional supporting history for commits created after the base; an empty commit history does not imply an empty final diff. Git capture failures mark the run as `runner_error` rather than emitting a successful-looking empty patch. Disposable repository, package, home, and Pi config clones are removed after evidence capture.

Normalized statuses are `passed`, `child_failed`, `timed_out`, `configuration_mismatch`, `verification_failed`, and `runner_error`. Missing telemetry or pricing remains explicitly unknown; it is never converted to zero.

## Results and report

The evaluation output directory contains:

- `results.json`: canonical machine-readable matrix, run outcomes, telemetry, warnings, evidence, and local retained-artifact references.
- `report.html`: self-contained comparison UI with no embedded transcripts. Open it directly from disk in a browser.
- `runs/<scenario>/<profile>/`: retained per-run evidence and requested artifacts, including the base-to-final-worktree `diff.patch` and optional `commits.txt` history.

Regenerate HTML using only canonical results (no Pi session or repository access is required):

```sh
npm run eval -- --report ~/.pi/agent/evals/mvp-smoke/results.json
```

An optional second path writes elsewhere:

```sh
npm run eval -- --report ~/.pi/agent/evals/mvp-smoke/results.json /tmp/mvp-smoke-report.html
```

Do not copy or commit generated `results.json`, `report.html`, sessions, logs, diffs, or other live evaluation artifacts into this repository.

## Add a deterministic scenario

1. Add one scenario with a narrow prompt and an objectively verifiable outcome.
2. Add a repository-owned verifier that exits nonzero for missing, incorrect, or extraneous changes. When regression coverage is required, preferably prove candidate tests pass against the candidate implementation and fail against the baseline; self-test plausible false positives such as comment-only coverage, partial fixes, or symptom-only fixes where relevant.
3. Keep the action quick, side-effect free, and safe to repeat from equivalent base state.
4. Declare only useful retained artifacts; generated files still belong in the external evaluation output.
5. Add a behavior-level test for the manifest matrix and verifier.
6. Dry-run first, then execute only the intended matrix.

The MVP `exact-repository-edit` scenario demonstrates this path: Pi must create one exact file using repository tools, while `verify.mjs` checks both its bytes and that it is the only repository change. It is intentionally one tracer bullet, not a benchmark suite.
