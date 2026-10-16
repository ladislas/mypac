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

When the reviewed change has no prior commit to target, inspect its index/worktree split before editing:

```bash
git status --porcelain
git diff --staged -- <file>
git diff -- <file>
```

A file with both staged and unstaged changes is partially staged. Preserve the original staged/unstaged intent and unrelated edits: leave the index unchanged and apply only the requested fix to the working tree. Do not stage a reviewed baseline, reset, restore, or stash user changes. This applies to wholly staged, wholly unstaged, partially staged, and untracked files; a fix to staged code remains an unstaged delta against the original index. Do not create a fixup commit.

Before editing, retain the original staged diff and relevant working-tree contents/diff for comparison. If an unmerged index, overlapping user edits, or another ambiguous state prevents safe preservation, stop and ask the user how to proceed before changing anything. Do not silently choose a staging boundary.

After fixing, verify the staged diff is unchanged and the working-tree delta contains only the intended fix while preserving unrelated edits (including untracked files). Report the verification and that fixes remain unstaged; do not claim the original reviewed baseline was staged.

## History safety

- Never run `git rebase --autosquash` automatically or rewrite history without explicit user approval.
- Never force push. If a later workflow requires one, stop and ask the user to perform it.
- Do not amend or retarget unrelated commits.

After all fixes, report each fix, its verification, each fixup commit and target SHA, or the staged/unstaged state for uncommitted work. Ask whether to continue fixing or leave the fixups as-is only when that next action is not already authorized. Offer autosquash only as a user-authorized next step; do not execute it automatically.
