import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseManifest } from "../../scripts/pac-eval.ts";

const directory = new URL("./", import.meta.url);

async function manifest() {
	return parseManifest(
		JSON.parse(await readFile(new URL("manifest.json", directory), "utf8")),
		directory.pathname,
	);
}

test("review progression evaluation uses only quota-conscious Luna medium", async () => {
	const parsed = await manifest();
	assert.equal(parsed.profiles.length, 1);
	assert.equal(parsed.profiles[0].model, "openai-codex/gpt-6-luna");
	assert.equal(parsed.profiles[0].thinking, "medium");
	assert.deepEqual(parsed.profiles[0].package.resources.skills, [
		"skills/pac-review",
		"skills/pac-review-standards-spec",
	]);
});

test("review progression evaluation covers default, explicit follow-up, and fix branches", async () => {
	const parsed = await manifest();
	assert.deepEqual(parsed.scenarios.map(({ id }) => id), [
		"ordinary-review",
		"standards-spec",
		"fix-findings",
	]);

	const [ordinary, standards, fix] = parsed.scenarios;
	assert.match(ordinary.prompt, /diff first/i);
	assert.match(ordinary.prompt, /do not perform Standards or Spec.*do not enter a fix workflow/is);
	assert.match(standards.prompt, /explicitly requested Standards \+ Spec follow-up/i);
	assert.match(standards.prompt, /changed paths.*best originating decision/is);
	assert.match(fix.prompt, /load.*fix-findings reference only now/is);
	assert.match(fix.prompt, /Do not autosquash, rebase, rewrite history, or force push/i);
	for (const scenario of parsed.scenarios) {
		assert.match(scenario.prompt, /## Read progression/);
	}
});
