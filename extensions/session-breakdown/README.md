# Session Breakdown Extension

Registers `/session-breakdown` to summarize local Pi usage from JSONL files under the resolved Pi agent session directory. By default this is `~/.pi/agent/sessions`; `PI_CODING_AGENT_DIR`, `TAU_CODING_AGENT_DIR`, or another `*_CODING_AGENT_DIR` override is honored when set.

The command reports 7, 30, and 90 day aggregates for sessions, messages, tokens, cost, models, and working directories when those fields are present in the session logs.

Privacy notes:

- Analysis stays local.
- No session data is sent to a model or external service.
- Output is aggregate-only and avoids raw prompts, assistant responses, and tool-call contents.
- Directory paths are abbreviated for display.
