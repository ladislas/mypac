# Deliver GitHub-backed work through a PR

Load this conditional procedure when an authorized workflow calls for PR delivery after implementation. Explicit `/pac-lwot` invocation is authorization to commit coherent verified work, push the working branch, and create or update its PR by default for actionable GitHub-backed work. It is not authorization for other commands or from an AFK label alone. Explicit narrower instructions (including no-push), stronger repository restrictions (including a prohibition on agent pushes), and access limitations take precedence. Never infer permission for merge, force-push, or history rewrite.

1. **Resolve destination.** Use the already-resolved repository policy for branch naming, protected/default branches and base strategy; do not invent a main-base rule. Confirm current branch and intended PR base before publication. Look for an existing matching implementation PR (including closed/merged state where relevant); reuse/update it rather than duplicate it. If no corresponding PR exists, create a new PR against the resolved base. For stacked work, name the dependency and base and review the immediate-parent diff, not just the diff against the default branch. Do not modify unrelated PRs.
2. **Commit and publish.** Apply `SKILL.md` for scoped commits, hooks and issue references. A commit still requires a coherent slice, proportionate verification (or strongest available evidence), and permission. Carry issue identity: use `Closes #N` for a completed issue and `Refs #N` for substantive unfinished work under the existing issue-link rules. Before push, check the target-to-slice closure and verify the intended branch/diff. Push only when authorized by this invocation or another explicit user instruction and permitted by local policy; never push protected branches. If push or PR creation/update fails, report the publication failure and blocker; do not call local commits delivered.
3. **PR and remote verification.** Write or update a concise PR description with the result, verification, material limitations, issue linkage (`Closes #N` or `Refs #N` as appropriate), and, for stacked PRs, dependency and base. Do not overwrite unrelated user-authored PR details. Verify the remote branch head SHA matches the published local head; verify the PR head, intended base and issue linkage from remote state. Inspect available checks on the published head: distinguish passed, pending, failed, and unavailable (including no checks reported). Address relevant failures where possible; do not present failed checks as complete or wait indefinitely for pending checks.
4. **Report.** Use the concise format below. If no PR was published, say so explicitly and report the last verified state. Merge remains outside this procedure unless separately authorized and permitted.

## Final report format

Keep these labels and order, replacing placeholders with verified values. The `<br>` tags keep the metadata on consecutive rendered lines without trailing whitespace; leave one blank line after Git.

Status: <actual status><br>
Issue: [#N](<complete issue URL>) — <complete issue URL><br>
PR: [#N](<complete PR URL>) — <complete PR URL><br>
Git: <branch> → <base> · <published head SHA>

Result: <one sentence describing resulting behavior><br>
Verification: Local — <results>. Remote — <check results>.<br>
Remaining: <blockers, limitations or follow-ups; otherwise None>.

Choose one actual status: PR published, Partial, Blocked, or No change; never print the alternatives as the result. PR published means publication, not passed checks, merge, or issue closure. Use complete issue and PR URLs as Markdown links and display each full URL as visible text beside its link when available; preserve explicit target identity and do not invent issue associations. For missing or inapplicable fields, state the state explicitly: Issue: Not applicable; PR: Not published; Remote: Unavailable; Git: Not inspected. When publication fails, distinguish a verified local HEAD from an unverified or unpublished remote SHA; report the blocker and last verified state. Report remote checks as passed, pending, failed, or unavailable; never treat pending or failed as passed. For stacked work, include the dependency PR link and its Git branch and base. Include only task-specific findings material to review or next action; put detailed evidence in the PR and keep the final report short.
