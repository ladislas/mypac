# Fix Review Findings

Load this reference only when the user requests applying review findings, including `/review-end` → “Return and fix findings” or `/pac-fix-copilot-review`. It is not review-time context.

## Committed changes

For each independent finding:

1. Before editing, run `git blame <file> -L <start>,<end>` on the finding’s lines.
2. Select the commit that introduced the defective line or behavior. Do not target a convenient later commit merely because it touched the file.
3. Apply and verify the smallest fix; follow `skills/pac-tdd/SKILL.md` for behavior-changing fixes.
4. Create one atomic `git commit --fixup <target-sha>` for that finding. Do not combine fixes with different blame targets.

Load `skills/pac-commit/SKILL.md` when the verified fix is ready to commit and follow its fixup procedure.

## Uncommitted changes

When the reviewed change has no prior commit to target, stage the file’s current reviewed state before editing:

```bash
git add <file>
```

Apply the fix and leave its delta unstaged so the user can distinguish it from the reviewed baseline. Do not create a fixup commit.

## History safety

- Never run `git rebase --autosquash` automatically or rewrite history without explicit user approval.
- Never force push. If a later workflow requires one, stop and ask the user to perform it.
- Do not amend or retarget unrelated commits.

After all fixes, report each fix, its verification, each fixup commit and target SHA, or the staged/unstaged state for uncommitted work. Ask whether to continue fixing or leave the fixups as-is only when that next action is not already authorized. Offer autosquash only as a user-authorized next step; do not execute it automatically.
