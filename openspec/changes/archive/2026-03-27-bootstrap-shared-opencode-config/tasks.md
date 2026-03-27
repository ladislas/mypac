## 1. Define the shared kit structure

- [x] 1.1 Decide and document the canonical shared namespace (`pac-`) and where shared agents, commands, and skills live in the repository
- [x] 1.2 Decide and document how canonical `pac-` identifiers map to visible user-facing names for shared assets
- [x] 1.3 Update repository-level documentation to describe this repo as a reusable OpenCode kit loaded via `OPENCODE_CONFIG_DIR` with project-local `.opencode/` overlays
- [x] 1.4 Confirm the bootstrap structure uses the smallest required structural changes before refactoring existing assets
- [x] 1.5 Create an atomic commit for the shared kit structure once section 1 is complete and verified

## 2. Bootstrap the initial shared asset set

- [x] 2.1 Refactor the existing Rick agents into the shared-kit structure without changing their plan/build behavior
- [x] 2.2 Promote the existing OpenSpec commands and OpenSpec support skills as the initial canonical shared command/skill set
- [x] 2.3 Add only the minimum placeholder shared assets needed to validate the architecture without importing the broader external skill catalog
- [x] 2.4 Create an atomic commit for the bootstrap asset set once section 2 is complete and verified

## 3. Validate layering and collision rules

- [x] 3.1 Define and document the rule that shared skill names are canonical and project-local specializations must use distinct names
- [x] 3.2 Test the shared kit in another repository by loading it through `OPENCODE_CONFIG_DIR` with local `.opencode/` additions to confirm the layering model works without copying the shared assets into the target project
- [x] 3.3 Review the bootstrap set for OpenCode-only compatibility and remove or defer any framework-specific assumptions
- [x] 3.4 Create an atomic commit for layering and compatibility validation once section 3 is complete and verified
