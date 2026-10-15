import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("issue creation skill links to existing relationship guidance", async () => {
	const core = await readFile(new URL("./SKILL.md", import.meta.url), "utf8");
	assert.ok(core.includes("](LINKING.md)"));
	assert.ok((await readFile(new URL("./LINKING.md", import.meta.url), "utf8")).trim());
});
