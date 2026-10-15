import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const skill = await readFile(new URL("./SKILL.md", import.meta.url), "utf8");
const issue = skill.split("### `create-issue`")[1].split("## GitHub safety rules")[0];

// Static published-template formatting, not evidence of agent publication or readiness decisions.
test("published PRD issue template has a scannable human summary", () => {
	assert.match(issue, /```md\s*## Human summary/);
	for (const field of ["Status", "Goal", "Why", "Proposed change", "Human decisions", "Scope"]) {
		assert.match(issue, new RegExp(`\\*\\*${field}:\\*\\*`));
	}
	for (const field of ["Status", "Goal", "Why", "Proposed change", "Human decisions"]) {
		const line = issue.split("\n").find((line) => line.startsWith(`**${field}:**`));
		assert.ok(line?.endsWith("\\"), `${field} must end with a Markdown hard break`);
	}
});
