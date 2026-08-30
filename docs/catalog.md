# Asset catalog

mypac groups reusable Pi assets by how they affect a session. Repo-local prompts and skills use the `pac-` prefix to avoid collisions with other packages.

## Extensions

| Extension | Surface | What it adds |
| --- | --- | --- |
| [`answer`](../extensions/answer/) | `/answer`, `ctrl+.` | Interactive Q&A for answering questions from the latest assistant message |
| [`ask`](../extensions/ask/) | `/ask` | Discussion-only mode that prevents accidental changes |
| [`btw`](../extensions/btw/) | `/btw` | Isolated sidechat for questions and exploration |
| [`commit-message-guard`](../extensions/commit-message-guard/) | `bash` guard | Blocks literal escaped newlines in Git commit message arguments |
| [`context`](../extensions/context/) | `/context` | Loaded-context and skill visibility |
| [`files`](../extensions/files/) | `/files`, shortcuts | Repository and session file browsing actions |
| [`footer`](../extensions/footer/) | Footer | Model, context, cache, cost, and provider-usage status |
| [`ghi`](../extensions/ghi/) | `/ghi` | GitHub issue creation through `gh` |
| [`headroom`](../extensions/headroom/) | `/headroom` | Optional local Headroom proxy lifecycle and status |
| [`notify`](../extensions/notify/) | `/notify-test`, background behavior | Terminal notifications when Pi is ready for input |
| [`pac-setup-workflows`](../extensions/pac-setup-workflows/) | `/pac-setup-workflows` | GitHub workflow label inspection and setup |
| [`personas`](../extensions/personas/) | `/persona` | Runtime persona discovery and selection |
| [`review`](../extensions/review/) | `/review-start`, `/review-end` | Guided code-review sessions |
| [`session-breakdown`](../extensions/session-breakdown/) | `/session-breakdown` | Session cost, model, directory, cache, and context statistics |
| [`session-names`](../extensions/session-names/) | Background behavior | Work-context names for implementation and planning sessions |
| [`shared-append-system`](../extensions/shared-append-system/) | Background behavior | Shared project instructions appended to the system prompt |
| [`slidedeck`](../extensions/slidedeck/) | `/pac-slidedeck` | Self-contained HTML presentations saved outside the repository |
| [`todos`](../extensions/todos/) | `todo` tool, `/todos` | File-based task tracking under `.pi/todos` |
| [`undo`](../extensions/undo/) | `/undo` | Restore the previous user message to the editor |
| [`uv`](../extensions/uv/) | `bash` wrapper | Redirect Python workflows toward `uv` |
| [`whimsical`](../extensions/whimsical/) | Background behavior | Rotating working messages while Pi runs |
| [`worktrunk`](../extensions/worktrunk/) | `/worktree` | Focused Worktrunk shortcuts for issue and branch worktrees |

## Skills

Skills contain reusable instructions. Pi may load model-invocable skills when a task matches; workflow-only skills marked `disable-model-invocation: true` are loaded through explicit workflow entrypoints.

| Skill | Purpose |
| --- | --- |
| [`pac-caveman`](../skills/pac-caveman/SKILL.md) | Ultra-compressed communication mode |
| [`pac-changelog`](../skills/pac-changelog/SKILL.md) | Maintain the repository changelog |
| [`pac-commit`](../skills/pac-commit/SKILL.md) | Plan and create atomic commits |
| [`pac-diagnose`](../skills/pac-diagnose/SKILL.md) | Diagnose bugs and performance regressions systematically |
| [`pac-explore`](../skills/pac-explore/SKILL.md) | Explore ideas and options without implementing |
| [`pac-github`](../skills/pac-github/SKILL.md) | Interact with GitHub through `gh` |
| [`pac-github-issue-create`](../skills/pac-github-issue-create/SKILL.md) | Create GitHub issues from Pi |
| [`pac-grill-me`](../skills/pac-grill-me/SKILL.md) | Stress-test a plan one question at a time |
| [`pac-grill-with-docs`](../skills/pac-grill-with-docs/SKILL.md) | Refine issue-backed work and preserve decisions |
| [`pac-handoff`](../skills/pac-handoff/SKILL.md) | Prepare concise context for another session or agent |
| [`pac-improve-architecture`](../skills/pac-improve-architecture/SKILL.md) | Find and evaluate architecture improvements |
| [`pac-librarian`](../skills/pac-librarian/SKILL.md) | Cache remote repositories for reference work |
| [`pac-pi-extension`](../skills/pac-pi-extension/SKILL.md) | Create and refactor Pi extensions safely |
| [`pac-pi-prompt`](../skills/pac-pi-prompt/SKILL.md) | Author prompt templates in this repository |
| [`pac-pi-skill`](../skills/pac-pi-skill/SKILL.md) | Author and refactor Pi skills |
| [`pac-review`](../skills/pac-review/SKILL.md) | Review code changes using the project rubric |
| [`pac-review-standards-spec`](../skills/pac-review-standards-spec/SKILL.md) | Follow up a review against standards and specifications |
| [`pac-session-review`](../skills/pac-session-review/SKILL.md) | Review one selected Pi session for actionable setup friction |
| [`pac-tdd`](../skills/pac-tdd/SKILL.md) | Implement behavior changes in tested vertical slices |
| [`pac-to-issues`](../skills/pac-to-issues/SKILL.md) | Decompose plans into independently grabbable issues |
| [`pac-to-prd`](../skills/pac-to-prd/SKILL.md) | Synthesize context into a PRD |
| [`pac-triage`](../skills/pac-triage/SKILL.md) | Triage issues through the project's label workflow |
| [`pac-upstream-checkpoints`](../skills/pac-upstream-checkpoints/SKILL.md) | Compare local assets with upstream inspiration sources |
| [`pac-uv`](../skills/pac-uv/SKILL.md) | Use `uv` for Python workflows |
| [`pac-zoom-out`](../skills/pac-zoom-out/SKILL.md) | Map how an unfamiliar code area fits together |

## Prompts

Prompts are the slash-command entry points you type in Pi.

| Prompt | Purpose |
| --- | --- |
| [`/pac-caveman`](../prompts/pac-caveman.md) | Enter ultra-compressed communication mode |
| [`/pac-diagnose`](../prompts/pac-diagnose.md) | Investigate a bug or performance regression |
| [`/pac-explore`](../prompts/pac-explore.md) | Enter open-ended exploration mode |
| [`/pac-fix-copilot-review`](../prompts/pac-fix-copilot-review.md) | Address GitHub Copilot PR review comments |
| [`/pac-grill-me`](../prompts/pac-grill-me.md) | Stress-test a plan conversationally |
| [`/pac-grill-with-docs`](../prompts/pac-grill-with-docs.md) | Refine issue-backed work with durable notes |
| [`/pac-handoff`](../prompts/pac-handoff.md) | Prepare a session handoff |
| [`/pac-hello-world`](../prompts/pac-hello-world.md) | Confirm that the package is loaded |
| [`/pac-improve-architecture`](../prompts/pac-improve-architecture.md) | Explore architecture-deepening opportunities |
| [`/pac-llat`](../prompts/pac-llat.md) | Classify a target and route it to the appropriate workflow |
| [`/pac-lwot`](../prompts/pac-lwot.md) | Execute work from available context |
| [`/pac-session-review`](../prompts/pac-session-review.md) | Review one explicitly selected Pi session |
| [`/pac-to-issues`](../prompts/pac-to-issues.md) | Split a plan or PRD into implementation issues |
| [`/pac-to-prd`](../prompts/pac-to-prd.md) | Turn context into a PRD |
| [`/pac-triage`](../prompts/pac-triage.md) | Triage GitHub issues |
| [`/pac-upstream-checkpoints`](../prompts/pac-upstream-checkpoints.md) | Review tracked upstream inspiration sources |
| [`/pac-zoom-out`](../prompts/pac-zoom-out.md) | Map an unfamiliar code area |

## Personas and themes

- [`personas/rick.md`](../personas/rick.md) provides the initial runtime persona.
- [`themes/`](../themes/) contains Gruvbox Dark, Night Owl, and Nord themes.

## Naming and discovery

The longer `pac-` names are intentional: they avoid collisions when several Pi packages are loaded. Pi's fuzzy slash-command finder keeps them quick to access.

For authoring rules, see the [development guide](development.md).
