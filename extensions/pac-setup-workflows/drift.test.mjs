import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_PAC_LABELS } from "./config.ts";
import { analyzeLabels, buildApplyPlan, normalizeColor } from "./drift.ts";

const label = (name, color = "000000", description = "") => ({ name, color, description });
const required = (name) => REQUIRED_PAC_LABELS.find((item) => item.name === name);

test("normalizeColor strips leading hash and uppercases", () => {
	assert.equal(normalizeColor("#bfDadc"), "BFDADC");
});

test("analyzeLabels reports all required pac labels as missing when none exist", () => {
	const result = analyzeLabels([label("bug"), label("enhancement")]);
	assert.equal(result.missing.length, REQUIRED_PAC_LABELS.length);
	assert.deepEqual(
		result.hostOwned.map((item) => item.name).sort(),
		["bug", "enhancement"],
	);
});

test("analyzeLabels detects metadata drift for existing pac labels", () => {
	const expected = required("pac:prd");
	const actualColor = expected.color === "000000" ? "FFFFFF" : "000000";
	const actualDescription = `${expected.description} (outdated)`;
	const result = analyzeLabels([label(expected.name, actualColor, actualDescription)]);
	const drift = result.drifted.find((item) => item.expected.name === expected.name);
	assert.ok(drift);
	assert.deepEqual(drift.fields.color, { actual: actualColor, expected: expected.color });
	assert.deepEqual(drift.fields.description, { actual: actualDescription, expected: expected.description });
	const plan = buildApplyPlan(result);
	assert.deepEqual(plan.updates.find((item) => item.expected.name === expected.name)?.expected, expected);
});

test("analyzeLabels reports legacy migration candidates when target pac label is absent", () => {
	const result = analyzeLabels([label("prd", "C5DEF5", "legacy prd")]);
	assert.equal(result.migrationCandidates.length, 1);
	assert.equal(result.migrationCandidates[0].mapping.legacy, "prd");
	assert.equal(result.migrationCandidates[0].mapping.target, "pac:prd");
	assert.equal(result.conflicts.length, 0);
});

test("analyzeLabels reports previous role labels as migration candidates", () => {
	const result = analyzeLabels([
		label("needs-info", "F9D0C4", "legacy needs info"),
		label("ready-for-agent", "0E8A16", "legacy ready for agent"),
		label("ready-for-human", "1D76DB", "legacy ready for human"),
	]);
	assert.deepEqual(
		result.migrationCandidates.map((candidate) => [candidate.mapping.legacy, candidate.mapping.target]),
		[
			["needs-info", "pac:needs_info"],
			["ready-for-agent", "pac:ready_for_agent"],
			["ready-for-human", "pac:ready_for_human"],
		],
	);
});

test("analyzeLabels reports conflicts when both legacy and target labels exist", () => {
	const expected = required("pac:prd");
	const result = analyzeLabels([
		label("prd", "C5DEF5", "legacy prd"),
		label("pac:prd", expected.color, expected.description),
	]);
	assert.equal(result.migrationCandidates.length, 0);
	assert.equal(result.conflicts.length, 1);
	assert.equal(result.conflicts[0].mapping.legacy, "prd");
});

test("buildApplyPlan renames legacy labels instead of also creating their targets", () => {
	const result = analyzeLabels([label("prd", "C5DEF5", "legacy prd")]);
	const plan = buildApplyPlan(result);
	assert.deepEqual(
		plan.renames.map((item) => item.mapping.target),
		["pac:prd"],
	);
	assert.equal(plan.creates.some((item) => item.name === "pac:prd"), false);
});

test("unexpected pac labels are noticed but not managed", () => {
	const result = analyzeLabels([label("pac:custom_state", "123456", "custom")]);
	assert.deepEqual(result.unexpectedPacLabels.map((item) => item.name), ["pac:custom_state"]);
});
