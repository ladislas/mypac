## Why

The repository currently contains useful OpenCode agents, commands, and OpenSpec skills, but they are still organized as a single-repo setup rather than a reusable personal config system. We need a small, testable architecture that can become the shared source of truth across projects without forcing a big-bang migration or importing every external skill immediately.

## What Changes

- Establish a reusable OpenCode config architecture for this repository as a personal shared kit.
- Define a namespaced convention for shared agents, commands, and skills so global and project-local assets can coexist without collisions.
- Add an initial bootstrap set of shared assets based on what already exists in this repo, plus lightweight placeholders where needed to validate the structure.
- Document how shared config is layered with project-local `.opencode/` overrides while keeping the human in the loop.

## Capabilities

### New Capabilities

- `shared-opencode-config`: Define the repository as a reusable, opinionated OpenCode configuration kit with a canonical structure, namespacing rules, and layering model for reuse across projects.

### Modified Capabilities

- `rick-persona-agents`: Extend the existing Rick agent capability so the Rick agents fit into the shared config architecture and naming strategy without changing their core plan/build behavior.

## Impact

- Affects `.opencode/agents/`, `.opencode/commands/`, and `.opencode/skills/`
- Affects repository documentation and OpenSpec guidance for how shared config should be reused in other projects
- Creates a foundation for future imported skills and commands without adding the full external catalog yet
