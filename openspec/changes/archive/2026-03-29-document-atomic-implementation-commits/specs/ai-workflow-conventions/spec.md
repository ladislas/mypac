## ADDED Requirements

### Requirement: Repository defines atomic implementation commit boundaries

The repository SHALL document that implementation work is committed during execution as small, coherent, verifiable units of progress rather than only at the end of the entire change.

#### Scenario: Reader applies atomic commits to an OpenSpec change

- **WHEN** a reader follows repository guidance for implementing an OpenSpec change
- **THEN** the guidance tells them to commit after each meaningful numbered task section or task group once that section is complete and verified
- **AND** the guidance tells them to include the corresponding `tasks.md` checkbox updates in that same commit
- **AND** the guidance tells them not to create one commit for every tiny checkbox or file

#### Scenario: Reader applies atomic commits to manual work

- **WHEN** a reader follows repository guidance for implementing a meaningful change without OpenSpec
- **THEN** the guidance tells them to use the same atomic-commit principle with coherent manual task groups or work slices
- **AND** the guidance tells them not to wait until the end of all work to create a single large commit

### Requirement: Repository requires explicit commit file selection

The repository SHALL document that each commit is created from an explicit file list for the intended logical change, even when unrelated files are already staged.

#### Scenario: Unrelated staged files exist during commit creation

- **WHEN** a contributor or agent prepares a commit for one logical task group
- **AND** other unrelated files are already staged in the repository
- **THEN** the guidance tells them to stage or commit only the files belonging to the current task group
- **AND** the guidance tells them it is acceptable to leave unrelated staged files out of that commit
