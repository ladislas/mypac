## 1. Hidden sidecar persistence

- [ ] 1.1 Add BTW sidecar path and metadata helpers that map a main session to a hidden sidecar under the project session directory.
- [ ] 1.2 Move BTW thread/reset persistence and restore logic from main-session inline entries to the sidecar session file.
- [ ] 1.3 Add best-effort migration so legacy inline BTW history is recovered into a new sidecar when no sidecar exists yet.

## 2. BTW lifecycle and import semantics

- [ ] 2.1 Record BTW open-time anchor metadata without automatically importing main-session context.
- [ ] 2.2 Implement explicit import and refresh behavior so the first import uses the launch anchor, later refresh uses current main-session state, and only the latest imported snapshot stays active for BTW prompts.
- [ ] 2.3 Preserve the in-overlay `Import context` action and visible imported-context markers while simplifying PR #57's implementation where the sidecar architecture allows it.

## 3. Session-scoped behavior and verification

- [ ] 3.1 Ensure BTW sidecar reuse/reset follows main-session identity rules across reopen, reload, branch navigation, new sessions, and fork/clone flows.
- [ ] 3.2 Remove the old main-session BTW persistence path once sidecar persistence is in place.
- [ ] 3.3 Add or update automated coverage where practical and complete manual verification for legacy migration, session lifecycle, import/refresh behavior, and hidden-session storage.
