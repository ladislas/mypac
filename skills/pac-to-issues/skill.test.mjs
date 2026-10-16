import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const skill = await readFile(new URL("./SKILL.md", import.meta.url), "utf8");
const template = skill.split("## Issue body template")[1];

// Static template formatting, not evidence of agent issue creation or readiness decisions.
test("issue template starts with a human summary and retains detailed sections", () => {
	assert.match(template, /^\s*```md\s*## Human summary/m);
	for (const field of ["Status", "Goal", "Why", "Proposed change", "Human decisions", "Scope"]) {
		assert.match(template, new RegExp(`\\*\\*${field}:\\*\\*`));
	}
	for (const field of ["Status", "Goal", "Why", "Proposed change", "Human decisions"]) {
		const line = template.split("\n").find((line) => line.startsWith(`**${field}:**`));
		assert.ok(line?.endsWith("\\"), `${field} must end with a Markdown hard break`);
	}
	for (const section of ["Summary", "Motivation", "Acceptance Criteria", "Type", "Parent", "Blocked by"]) {
		assert.ok(template.indexOf(`## ${section}`) > template.indexOf("## Human summary"));
	}
});
