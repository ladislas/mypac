import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const skill = await readFile(new URL("./SKILL.md", import.meta.url), "utf8");
const draft = skill.split("### `draft-only`")[1].split("### `comment-on-issue`")[0];
const comment = skill.split("### `comment-on-issue`")[1].split("### `create-issue`")[0];
const issue = skill.split("### `create-issue`")[1].split("## GitHub safety rules")[0];

test("human summary wraps only published PRD issues", () => {
	assert.match(issue, /Prepend.*GitHub issue body only/i);
	assert.match(issue, /```md\s*## Human summary/);
	for (const field of ["Status", "Goal", "Why", "Proposed change", "Human decisions", "Scope"]) {
		assert.match(issue, new RegExp(`\\*\\*${field}:\\*\\*`));
	}
	for (const field of ["Status", "Goal", "Why", "Proposed change", "Human decisions"]) {
		const line = issue.split("\n").find((line) => line.startsWith(`**${field}:**`));
		assert.ok(line?.endsWith("\\"), `${field} must end with a Markdown hard break`);
	}
	assert.match(issue, /PRD.*authoritative/i);
	assert.match(issue, /no bottom `TL;DR`/i);
	assert.doesNotMatch(draft, /Human summary/);
	assert.doesNotMatch(comment, /Human summary/);
});

test("readiness and ready-for-agent label share one decision", () => {
	assert.match(issue, /unresolved human decisions.*🟡 Human decisions required/i);
	assert.match(issue, /no unresolved human decisions.*🟢 Ready for implementation/i);
	assert.match(issue, /pac:ready_for_agent.*only.*🟢 Ready for implementation/i);
	assert.match(issue, /🟡 Human decisions required.*never.*pac:ready_for_agent/i);
	assert.match(issue, /pac:prd.*only.*label.*exist/i);
});
