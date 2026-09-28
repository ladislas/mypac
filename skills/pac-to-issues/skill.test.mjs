import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const skill = await readFile(new URL("./SKILL.md", import.meta.url), "utf8");
const template = skill.split("## Issue body template")[1];

test("published issue starts with a human summary and keeps the detailed contract", () => {
	assert.match(template, /^\s*```md\s*## Human summary/m);
	for (const field of ["Status", "Goal", "Why", "Proposed change", "Human decisions", "Scope"]) {
		assert.match(template, new RegExp(`\\*\\*${field}:\\*\\*`));
	}
	for (const section of ["Summary", "Motivation", "Acceptance Criteria", "Type", "Parent", "Blocked by"]) {
		assert.ok(template.indexOf(`## ${section}`) > template.indexOf("## Human summary"));
	}
	assert.match(skill, /detailed issue body.*authoritative/i);
	assert.match(skill, /no bottom `TL;DR`/i);
});

test("AFK and HITL map mechanically to readiness and human decisions", () => {
	assert.match(skill, /AFK.*🟢 Ready for implementation/);
	assert.match(skill, /HITL.*🟡 Human decisions required/);
	assert.match(skill, /AFK.*Human decisions.*None/i);
	assert.match(skill, /HITL.*concrete human decisions/i);
});
