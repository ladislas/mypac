## Why

This repository has effectively completed the OpenCode → Pi migration in practice: Pi is now the daily driver, while the remaining OpenCode config, docs, tasks, and compatibility assets mostly create maintenance overhead and contradictory guidance. Retiring OpenCode support now will align the repository with actual usage, reduce stale documentation, and remove migration-era baggage.

## What Changes

- **BREAKING** remove OpenCode as a supported runtime for this repository, including `opencode.json`, the local `mise run opencode` launcher, OpenCode validation tasks, and the runtime-awareness plugin.
- Make Pi the sole supported interface in active documentation and package metadata, with the README as the primary setup entrypoint.
- Review OpenCode-only command assets and keep only workflows still worth porting or preserving in a Pi-native form.
- Create a GitHub issue that preserves the current Rick persona agent content as future work for Pi-native persona support, then remove the current OpenCode agent files from the active repo surface.
- Prune or simplify stale strategy/interface documentation (for example ADRs or playbooks) when it no longer adds practical value and risks going stale.
- Keep OpenSpec as the planning layer, but defer broader cleanup of existing OpenSpec historical/current specs to a later collaborative pass.

## Capabilities

### New Capabilities

- `pi-default-workflow`: Define Pi as the repository's sole supported day-to-day interface and document the supported local setup clearly in the README.

### Modified Capabilities

- `shared-opencode-config`: Retire the repository's active role as a reusable OpenCode kit and remove OpenCode-facing source-of-truth guidance from the supported workflow.
- `local-opencode-mise-workflow`: Remove the supported local `mise` launcher workflow for OpenCode.
- `rick-persona-agents`: Stop requiring Rick persona agents as active runtime assets while preserving their content separately for possible future Pi persona support.
- `agent-runtime-awareness`: Remove the requirement for a local OpenCode runtime-awareness plugin from the supported repository workflow.

## Impact

- Affected files will include `README.md`, `package.json`, OpenCode-specific docs, OpenCode-oriented task scripts under `.mise/tasks/`, and current `agents/`, `commands/`, and `plugins/` assets.
- The `@opencode-ai/plugin` dependency will likely be removed if nothing else requires it.
- Some documentation under `docs/decisions/`, `docs/playbooks/`, and `docs/vision/` may be removed or simplified where it no longer matches the actual Pi-first setup.
- A GitHub issue will preserve the Rick persona content as future work instead of keeping inactive runtime files in the repository.
