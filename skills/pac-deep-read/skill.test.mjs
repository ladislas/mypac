import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("deep-read entrypoint references its skill and forwards arguments once", async () => {
	const prompt = await readFile(new URL("../../prompts/pac-deep-read.md", import.meta.url), "utf8");
	assert.match(prompt, /skills\/pac-deep-read\/SKILL\.md/);
	assert.ok((await readFile(new URL("./SKILL.md", import.meta.url), "utf8")).trim());
	assert.equal(prompt.match(/\$@/g)?.length, 1);
	assert.match(prompt, /\*\*Provided arguments\*\*: \$@\s*$/);
});
