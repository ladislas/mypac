import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseManifest } from "../../scripts/pac-eval.ts";

const manifestUrl = new URL("./manifest.json", import.meta.url);

async function manifest() {
	return parseManifest(
		JSON.parse(await readFile(manifestUrl, "utf8")),
		fileURLToPath(new URL("./", import.meta.url)),
	);
}

test("progressive triage evaluation uses the quota-conscious Luna profile", async () => {
	const parsed = await manifest();
	assert.equal(parsed.profiles.length, 1);
	assert.equal(parsed.profiles[0].model, "openai-codex/gpt-6-luna");
	assert.equal(parsed.profiles[0].thinking, "medium");
	assert.equal(parsed.profiles[0].workflow, "/pac-triage");
});

test("progressive triage evaluation keeps one cheap and two intentionally deep branches", async () => {
	const parsed = await manifest();
	assert.deepEqual(parsed.scenarios.map(({ id }) => id), [
		"cheap-override",
		"ready-for-agent-bug",
		"out-of-scope",
	]);

	const [cheap, bug, scope] = parsed.scenarios;
	assert.match(cheap.prompt, /do not inspect comments, linked artifacts, source\/docs, or prior scope decisions/i);
	assert.match(bug.prompt, /read the relevant comments.*inspect the focused source\/test.*smallest reproduction/is);
	assert.match(scope.prompt, /search the supplied structured precedent selectively/i);
});
