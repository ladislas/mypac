import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("review skill references existing fix and Standards + Spec resources", async () => {
	const core = await readFile(new URL("./SKILL.md", import.meta.url), "utf8");
	assert.ok(core.includes("FIX_FINDINGS.md"));
	assert.ok((await readFile(new URL("./FIX_FINDINGS.md", import.meta.url), "utf8")).trim());
	assert.ok(core.includes("skills/pac-review-standards-spec/SKILL.md"));
	assert.ok((await readFile(new URL("../pac-review-standards-spec/SKILL.md", import.meta.url), "utf8")).trim());
});
