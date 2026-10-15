---
description: "Address unresolved Copilot PR findings with fixup commits and published-fix thread resolution"
argument-hint: "[PR URL | PR number | current PR]"
---

Address GitHub Copilot review findings on the PR identified by the provided argument (URL or number), or infer the current branch's PR with `gh`.

1. **Target and filter**
   - Resolve the PR's repository, branch, and state. Ask if no PR can be identified; stop for a closed or merged PR unless explicitly asked to inspect it.
   - Use `gh` to read review threads and relevant review metadata. Select unresolved threads authored by `copilot-pull-request-reviewer[bot]` only; exclude humans and other bots unless explicitly requested. Note already resolved threads without reopening or repairing them.
2. **Assess and repair**
   - Summarize selected findings, assess their validity, and explain any skipped or disputed findings before editing. Do not resolve a disputed finding as fixed.
   - For valid findings, follow `skills/pac-review/FIX_FINDINGS.md` for focused repair and verification, and `skills/pac-commit/SKILL.md` and its `FIXUP.md` for explicit fixup commits. These procedures own branch safety, fixup targeting, staging, hooks, and history restrictions.
   - This command requests repair and fixup creation, not publication or history rewriting. Honor existing explicit authorization and stronger repository restrictions; do not add routine confirmation gates for already-authorized actions.
3. **Verify publication, then resolve**
   - Resolve only addressed Copilot threads, and only after verifying through the target PR's current remote head and code that the fixing code is published on that PR. A locally verified commit or a successful push alone is insufficient.
   - Publication requires explicit authorization independent of thread resolution. If authorization is absent, publication fails, or the PR does not contain the fix, leave the thread open and report the blocker.
   - Recheck thread state before resolving; skip threads already resolved. If resolution fails, report the thread URL and reason.
4. **Report**
   - List each finding's URL, assessment, fix and verification, fixup commit and target, publication evidence or blocker, and final thread status. Include skipped findings and whether autosquash was run; do not imply local fixes were delivered.

**Provided arguments**: $@
