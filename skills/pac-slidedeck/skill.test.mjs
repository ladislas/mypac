import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const skillUrl = new URL("./SKILL.md", import.meta.url);

test("pac-slidedeck defines a portable presentation-design capability", async () => {
	const skill = await readFile(skillUrl, "utf8");

	assert.match(skill, /^name: pac-slidedeck$/m);
	assert.match(skill, /explicitly asks for slides.*slide deck.*presentation/is);
	assert.match(skill, /not for ordinary documents or prose reports/i);
	assert.match(skill, /coherent through-line/i);
	assert.match(skill, /4–10 focused slides/i);
	assert.match(skill, /host environment's native presentation or artifact capability/i);
	assert.match(skill, /preserve untouched slides verbatim/i);
	assert.doesNotMatch(skill, /~\/\.pi|\/pac-[a-z0-9-]+|save_slidedeck|CONTEXT\.md|\bgh\s+(?:api|issue|pr)\b/);
});
