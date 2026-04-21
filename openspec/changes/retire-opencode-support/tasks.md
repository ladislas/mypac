## 1. Re-establish the active repository story

- [x] 1.1 Update `README.md` so Pi is the only supported interface and the README is the primary setup/source-of-truth document.
- [x] 1.2 Remove or simplify stale interface/strategy documents that no longer add practical value or that contradict the Pi-only setup.
- [x] 1.3 Align `package.json` Pi metadata with the directories and assets that actually remain in the Pi-only repository layout.

## 2. Remove OpenCode runtime and tooling

- [x] 2.1 Delete `opencode.json` and remove any package/dependency wiring that only exists for OpenCode support.
- [x] 2.2 Remove the OpenCode `mise` launcher and OpenCode-specific validation tasks from `.mise/tasks/`.
- [x] 2.3 Remove the OpenCode runtime-awareness plugin and any in-repo references to it.

## 3. Review shared workflow assets

- [x] 3.1 Audit the current OpenCode command files and decide which workflows still deserve a Pi-native surface.
- [x] 3.2 Port the selected still-useful workflows to Pi and remove the OpenCode command files that are no longer needed.

## 4. Preserve future persona work without keeping inactive runtime files

- [ ] 4.1 Create a GitHub issue that captures the current Rick persona agent content and explains that Pi persona support is future work.
- [ ] 4.2 Remove the current Rick agent files from the active repository surface once their content is preserved in the issue.

## 5. Verify the Pi-only end state

- [ ] 5.1 Re-scan the repository for active OpenCode-facing docs/config/task leftovers and remove any remaining supported-path references.
- [ ] 5.2 Run the relevant repo checks after the cleanup and confirm the Pi-only surface is internally consistent.
