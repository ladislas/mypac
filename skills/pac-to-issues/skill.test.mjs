import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const skill = await readFile(new URL("./SKILL.md", import.meta.url), "utf8");
const template = skill.split("## Issue body template")[1];
const intake = skill.split("### 1. Gather context")[1].split("### 3. Draft vertical slices")[0];

// Instruction contracts only; these do not simulate agent reads or GitHub publication.
test("complete contextualized plans can proceed without redundant issue or code reads", () => {
	assert.match(intake, /Reuse.*conversation.*already-read authoritative/s);
	assert.match(intake, /If.*body and metadata.*not already available/s);
	assert.match(intake, /--json number,title,body,state,labels,url/);
	assert.doesNotMatch(intake, /--comments/);
	assert.match(intake, /complete.*proceed directly.*drafting slices/s);
});

test("linked governing decisions and incomplete requirements require targeted reads", () => {
	assert.match(intake, /Before each additional read.*specific missing or ambiguous/s);
	assert.match(intake, /Follow explicit links or pointers.*PRDs.*Decisions\/ADRs.*acceptance criteria.*blockers/s);
	assert.match(intake, /targeted comment or linked-artifact reads.*before finalizing/s);
	assert.match(intake, /pointer is ambiguous.*locate the governing comment/s);
	assert.match(intake, /dependencies or acceptance criteria.*unresolved.*ask the user/s);
});

test("repository exploration is question-bound and free-form plans retain no parent wiring", () => {
	assert.match(intake, /specific unresolved slicing, dependency, interface, or verification question/);
	assert.match(intake, /Limit.*relevant area.*stop once.*answered/s);
	assert.match(intake, /free-form plan or PRD with no parent issue, skip parent wiring steps/);
});

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
