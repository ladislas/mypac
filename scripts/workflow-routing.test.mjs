import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatSkillsForPrompt, loadSkillsFromDir } from "@earendil-works/pi-coding-agent";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const workflowOnlySkills = [
	"pac-explore",
	"pac-grill-me",
	"pac-grill-with-docs",
	"pac-session-review",
	"pac-to-issues",
	"pac-to-prd",
];
const autoInvocableCapabilitySkills = [
	"pac-caveman",
	"pac-changelog",
	"pac-commit",
	"pac-deep-read",
	"pac-diagnose",
	"pac-github",
	"pac-github-issue-create",
	"pac-handoff",
	"pac-librarian",
	"pac-pi-extension",
	"pac-writing-for-agents",
	"pac-write-pi-prompts",
	"pac-review",
	"pac-slidedeck",
	"pac-tdd",
	"pac-uv",
	"pac-zoom-out",
];
const needsEvidenceSkills = [
	"pac-improve-architecture",
	"pac-review-standards-spec",
	"pac-triage",
	"pac-upstream-checkpoints",
];
const modelVisibleSkills = [...autoInvocableCapabilitySkills, ...needsEvidenceSkills];

async function readRepoFile(...segments) {
	return readFile(path.join(repoRoot, ...segments), "utf8");
}

// These exercise Pi's resource loader and model-context formatting, not agent routing decisions.
test("workflow-only skills stay out of model context but explicit prompts still load them", async () => {
	const { skills, diagnostics } = loadSkillsFromDir({
		dir: path.join(repoRoot, "skills"),
		source: "workflow-routing-test",
	});
	assert.deepEqual(diagnostics, []);
	const skillsByName = new Map(skills.map((skill) => [skill.name, skill]));
	const modelPrompt = formatSkillsForPrompt(skills);

	for (const name of workflowOnlySkills) {
		assert.equal(skillsByName.get(name)?.disableModelInvocation, true, `${name} should be workflow-only`);
		assert.doesNotMatch(modelPrompt, new RegExp(`<name>${name}</name>`));

		const explicitPrompt = await readRepoFile("prompts", `${name}.md`);
		assert.match(explicitPrompt, new RegExp(`skills/${name}/SKILL\\.md`));
	}
});

test("the intended model-visible skill set is an explicit metadata contract", () => {
	const { skills, diagnostics } = loadSkillsFromDir({
		dir: path.join(repoRoot, "skills"),
		source: "workflow-routing-test",
	});
	assert.deepEqual(diagnostics, []);

	const discoveredNames = skills.map((skill) => skill.name).sort();
	const classifiedNames = [...workflowOnlySkills, ...modelVisibleSkills].sort();
	assert.deepEqual(discoveredNames, classifiedNames, "all package skills should have an invocation classification");

	const visibleNames = skills
		.filter((skill) => !skill.disableModelInvocation)
		.map((skill) => skill.name)
		.sort();
	assert.deepEqual(visibleNames, modelVisibleSkills.toSorted());

	const modelPrompt = formatSkillsForPrompt(skills);
	for (const name of modelVisibleSkills) {
		assert.match(modelPrompt, new RegExp(`<name>${name}</name>`), `${name} should remain model-visible`);
	}
});
