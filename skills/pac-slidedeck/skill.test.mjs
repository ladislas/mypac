import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildSlidedeckPrompt } from "../../extensions/slidedeck/helpers.ts";

test("slidedeck prompt embeds the canonical skill verbatim", async () => {
	const skill = (await readFile(new URL("./SKILL.md", import.meta.url), "utf8")).trim();
	assert.ok(skill.length > 0);
	const prompt = buildSlidedeckPrompt("Turn this launch plan into slides");
	assert.ok(prompt.includes(skill), "Pi prompt should consume the canonical skill verbatim at runtime");
});
