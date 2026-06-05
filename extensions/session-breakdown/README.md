# Session Breakdown Extension

Registers `/session-breakdown` to summarize local Pi usage from JSONL files under the resolved Pi agent session directory. By default this is `~/.pi/agent/sessions`; `PI_CODING_AGENT_DIR`, `TAU_CODING_AGENT_DIR`, or another `*_CODING_AGENT_DIR` override is honored when set.

The default command output is a compact, colorized report with an overview table, cost insights, model/directory cost bars, an outlier diagnostic summary, and readable top-5 drill-down sections for expensive sessions, model efficiency, directory cost centers, and cache/context metrics when available. Git worktrees are grouped under their canonical repository in directory cost centers. Use `--no-color` to disable ANSI color in the report.

Workflow categories use a lightweight privacy-safe heuristic from session file paths and working directories only: names containing `llat`, `lwot`, `grill`, `review`, or `triage` map to those categories; names containing implementation-ish words such as `feature`, `bugfix`, `fix`, `commit`, or `implementation` map to `implementation`; everything else is `other`.

Privacy notes:

- Analysis stays local.
- No session data is sent to a model or external service.
- Output is aggregate-only and avoids raw prompts, assistant responses, and tool-call contents.
- Directory paths are abbreviated for display.
