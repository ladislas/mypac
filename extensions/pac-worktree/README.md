# Pac worktree

Worktrunk-backed Pi shortcuts for this repository. Worktrunk owns worktree lifecycle and hooks; the extension does not implement raw Git worktree management.

## Commands

```text
/pac-worktree
/pac-worktree 550
/pac-worktree https://github.com/ladislas/mypac/issues/550
/pac-worktree 550 --type bugfix
/pac-worktree branch ladislas/feature/experimental
/pac-worktree list
/pac-worktree status
```

The bare command offers an Issue / Branch / List / Status menu. Argument completions include examples and `--type feature|bugfix|release`. `ls` is an alias for `list`. `/worktree` has been replaced, without a competing compatibility alias.

## Issue identity and branches

Numbers resolve against `gh repo view` in the current repository. GitHub issue URLs must identify that same repository (case-insensitive); cross-repository URLs fail before Worktrunk mutation, without an override.

Existing worktrees and local branches are matched by delimited issue number, not the current title. #550 never matches #5500. A title change or `--type` override does not rename an existing branch. Multiple matches fail with an explicit branch-selection command rather than silently choosing one.

New branches follow `ladislas/<type>/<number>-<title-slug>`. The exact GitHub `bug` label defaults to `bugfix`; otherwise the default is `feature`. Use `--type feature|bugfix|release` to override. This is deliberately a mypac naming policy, not a generic repository-policy parser.

## Setup and trust

Requirements: authenticated `gh`, Git, `wt` with `config approvals list --format=json` support (verified with 0.75.0), and the tools required by project hooks.

Before creating a worktree, the extension checks project command approvals. Unapproved commands are displayed, with instructions to review and explicitly approve them in a terminal:

```sh
wt config approvals list
wt config approvals add
```

Then retry the original command. Unsupported or malformed approval inspection fails closed. The extension never adds approvals or passes `--yes` / `--no-hooks`. Already-approved hooks run normally. Existing worktrees are reused without re-running creation hooks.

Creation uses `wt switch --create --no-cd <branch>` for a new branch, or omits `--create` for an existing local branch. `--no-cd` is intentional: a child process cannot change the original Pi session's directory. Worktrunk still runs hooks. Setup errors are surfaced; a partially created worktree may remain and can be inspected with `wt list`.

In this repository, blocking `pre-start` hooks run `mise trust`, `mise install`, and `npm ci`. The extension does not independently execute setup commands or alter shell integration.

## Parallel Pi launch

After preparation, issue and branch commands open a **new iTerm window**, leaving the original Pi process and directory untouched. Detection requires macOS and `TERM_PROGRAM=iTerm.app` or `ITERM_SESSION_ID`. Other terminals are intentionally unsupported. macOS may ask you to allow terminal automation; denial is recoverable.

A static AppleScript calls iTerm's `create window with default profile command`. The command is passed as an argv value, not interpolated AppleScript or simulated keystrokes. A login zsh changes to the shell-quoted worktree path and replaces itself with Pi. Pi must be on that login shell's PATH, with this extension installed/enabled (normally via the mypac package).

For issues, a child-only `PAC_WORKTREE_DRAFT_ISSUE` environment value carries the canonical issue URL. This extension consumes/deletes it on `session_start` and calls `ctx.ui.setEditorText` in TUI mode. The initial draft is `/pac-lwot <issue-url>`: editable, clearable, and **never sent automatically**. Branch launches start with an empty editor. Without this extension in the child, the editor remains empty; copy the issue URL into it yourself.

This uses the pinned Pi **1.2.0** editor API. Its interactive-mode implementation maps `setEditorText` to `editor.setText`; positional CLI prompts instead call `session.prompt`, so the launcher never passes a positional prompt or writes Return. RPC/non-TUI startup never prefills.

## Manual launch and recovery

Unsupported terminals and failed AppleScript launches retain the prepared worktree, report the error, and include a single-line, shell-safe manual command, without Markdown fences or a submitted prompt:

```sh
wt switch ladislas/feature/550-example -x pi
```

Worktrunk's `-x` runs Pi in the selected worktree without requiring shell integration. It also makes launch recovery possible without recreating the worktree. `list` and `status` remain read-only.

### Verification references

- [iTerm AppleScript window creation](https://iterm2.com/documentation-scripting.html)
- [Worktrunk switch: `--no-cd` and `-x`](https://worktrunk.dev/switch/)
- [Worktrunk approval state](https://worktrunk.dev/config/)
- Pinned Pi: `dist/core/extensions/types.d.ts` and `dist/modes/interactive/interactive-mode.js` in `@earendil-works/pi-coding-agent@1.2.0`

Worktree removal, merge UX, and terminal-manager frameworks are out of scope.
