# Project Guidelines

This file is for `mypac`-specific instructions.
The shared execution heuristics live in `shared/SHARED_APPEND_SYSTEM.md` and are appended by the `extensions/shared-append-system` Pi extension.

## Changelog

For every meaningful change to mypac, explicitly consider whether `CHANGELOG.md` needs an update before the work is complete. Add an entry under `## [Unreleased]` for notable user-facing or workflow-facing changes, repository-operating/tooling behavior maintainers should know about, meaningful features, fixes, behavior changes, dependency/runtime changes, removals, or anything else worth release notes. Include it in the same coherent work/commit when practical.

Skip trivial noise: typo-only fixes, insignificant wording or formatting cleanup, and tiny internal edits with no useful release-note value. Reuse the standard `Added`, `Changed`, `Fixed`, `Removed`, or `Breaking Changes` headings as appropriate; do not invent one-off headings to work around lint. This is mypac repository policy, not a requirement for downstream repositories using pac skills.

## Git Commits

This repo uses [gitmoji](https://gitmoji.dev) commit messages:

```text
<emoji> <type>(<scope>): <summary>
```

Example: `✨ feat(auth): Add user authentication system`

- Create atomic commits during implementation, not only at the end of a change.
- Select the file list for each commit explicitly; if unrelated files are already staged, leave them out of the current commit.
- For detailed commit procedure, splitting, emoji selection, and hook behavior, follow `skills/pac-commit/SKILL.md`.

## Git Workflow

### Force Pushes

Agents/clankers must never force push to this repository. Force pushing rewrites shared history and is a user-only action, even when a repo command or workflow would normally perform a force push. If a workflow requires a force push, stop and ask the user to run that step manually.

### Updating Feature and PR Branches

Synchronize feature/PR branches with the repository's current default branch by rebasing, including when resolving base-branch conflicts. Never merge the default branch into a feature/PR branch. The agent force-push prohibition is not a reason to substitute a merge.

When a local rebase is explicitly authorized:

1. Start with a clean working tree. Resolve the default branch from authoritative repository metadata and fetch its remote-tracking ref, as shown below. Confirm the feature/PR branch's publication remote/ref. For an already-published branch, record its remote head OID **before rebasing**; do not refresh this expected OID merely to make a later push succeed.
2. Rebase onto the resolved remote-tracking ref (`git rebase "$default_ref"`), resolve conflicts, and complete the local rebase.
3. Verify that the current default branch is an ancestor (`git merge-base --is-ancestor "$default_ref" HEAD`) and that `git rev-list --merges "$default_ref..HEAD"` is empty. Review the intended diff (`git diff "$default_ref...HEAD"`) and conflict resolutions, confirm tests and changelog changes are preserved, and run proportionate validation. If the default branch advances before publication, synchronize and verify again under the same authorization rules.
4. If publication requires rewriting an already-published branch, stop before pushing and give the user the exact user-run command with the recorded OID and confirmed remote/ref. Agents must never execute this force push.

For a repository whose confirmed base remote is `origin`, resolve its default branch using GitHub repository metadata, require a nonempty result, and fetch that branch into an explicit remote-tracking ref:

```bash
default_branch=$(gh repo view "$(git remote get-url origin)" --json defaultBranchRef --jq '.defaultBranchRef.name')
test -n "$default_branch" || exit 1
default_ref="refs/remotes/origin/$default_branch"
git fetch origin "refs/heads/$default_branch:$default_ref"
```

Use this same `$default_ref` in all rebase and verification commands above. If the base remote differs, use that confirmed remote consistently in the metadata lookup, remote-tracking ref, and fetch.

For example, when the confirmed publication destination is `origin` and the remote branch name matches the current local branch, record these values before rebasing:

```bash
branch=$(git branch --show-current)
remote_ref="refs/heads/$branch"
expected_oid=$(git ls-remote --exit-code origin "$remote_ref" | cut -f1)
```

Only continue if the branch and expected OID are nonempty and the destination is correct. After local verification, the **user only** may run:

```bash
git push --force-with-lease="$remote_ref:$expected_oid" origin "HEAD:$remote_ref"
```

In the handoff, supply the command with the actual remote, full destination ref, and recorded OID substituted, rather than relying on shell variables surviving between sessions. The explicit lease rejects publication if the remote branch changed since that OID was recorded; stop and reconcile unexpected remote changes instead of refreshing the lease or overwriting them. If the destination differs from this example, use its confirmed remote/ref consistently for both the OID lookup and push.

This synchronization policy does not prohibit the intentional final `--no-ff` merge **into the default branch** described below; the existing user-run merge workflow remains unchanged.

### Branch Naming

Branches follow the pattern: `<firstname>/<type>/<topic-more_info>`

For work that originates from a GitHub issue, include the issue number in the topic:

```text
<firstname>/<type>/<issue-number>-<topic-more_info>
```

- Types: `feature`, `release`, `bugfix`
- Non-issue example: `ladislas/feature/dark-mode_ui`
- Issue-backed example: `ladislas/feature/85-worktrunk_issue_worktrees`

Always create a branch — keep `main` clean.

### Merging

**With a PR** (default for most work):

1. Open a PR for the branch on GitHub
2. From the feature branch, the user may run `git mmnoff`
   - Rebases on the default branch, force-pushes, then merges with `--no-ff`
   - Requires an open PR (command will fail otherwise)
   - Because this workflow force-pushes, agents/clankers must not run it

**Without a PR** (small/quick branches):

1. `git checkout main`
2. `git mnoff <branch-name>`

## Pi Extensions

> **Auto-discovery hazard**: Pi treats every `.ts` or `.js` file directly under `extensions/` as an extension entrypoint and tries to load it. A helper module placed there will break at startup.

Rules to follow every time extension code is touched:

- **Top-level `.ts` and `.js` files only for real entrypoints.** Do not put helpers, utilities, or shared modules directly under `extensions/`.
- **One directory per multi-file extension.** Use `extensions/<name>/index.ts` or `extensions/<name>/index.js` as the entrypoint and keep all sibling modules inside that directory:

  ```text
  extensions/<name>/index.ts       ← entrypoint (or index.js)
  extensions/<name>/helper.ts      ← safe, not auto-discovered
  extensions/<name>/helper.test.mjs
  ```

- **Colocate tests** inside the extension directory, not at a separate top-level location.
- What looks like a normal TypeScript refactor (extracting a helper file) is **unsafe** here if the file lands at `extensions/` top level.

For deeper guidance on creating or refactoring extensions, load `skills/pac-pi-extension/SKILL.md`.

## Pi Prompts

For Pi slash-command mechanics in `prompts/`, load `skills/pac-writing-for-pi/SKILL.md`.

## Agent-facing Instructions

For authoring skills, Pi prompts, `AGENTS.md`, shared system instructions, personas, or referenced instruction documents, load `skills/pac-writing-for-agents/SKILL.md`. It owns writing methodology; existing policy and specialized workflow owners remain authoritative.

For behavior-changing implementation work, feature slices, or bug fixes where regression coverage matters, load `skills/pac-tdd/SKILL.md`.

For disciplined bug diagnosis or performance-regression investigation, load `skills/pac-diagnose/SKILL.md`.

For GitHub issue triage, label-state recommendations, ready-for-agent briefs, needs-info comments, wontfix decisions, or out-of-scope scope-boundary comments, load `skills/pac-triage/SKILL.md`.

## Planning Workflow

- Use GitHub-native planning workflows for meaningful multi-step work.
- Prefer issue-backed PRD comments, ADR comments, and implementation issues over repo-local planning artifacts.
- For non-trivial work, keep the human in the loop: exploration, PRDs, issue breakdowns, and decisions should guide implementation rather than replace review and manual judgment.
- Use atomic commits for coherent manual task groups or work slices once they are complete and verified.
