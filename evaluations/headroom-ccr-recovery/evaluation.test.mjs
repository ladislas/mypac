import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseManifest } from "../../scripts/pac-eval.ts";

const root = new URL("./", import.meta.url);

test("CCR recovery evaluation exercises shared instructions with an opaque successful read", async () => {
	const parsed = await parseManifest(JSON.parse(await readFile(new URL("manifest.json", root), "utf8")), fileURLToPath(root));
	assert.deepEqual(parsed.profiles[0].package.resources.extensions, ["extensions/shared-append-system/index.ts"]);
	assert.match(parsed.scenarios[0].prompt, /successfully read.*<<ccr:.*buoy count and color/is);
	assert.doesNotMatch(parsed.scenarios[0].prompt, /\bbounded\b|\bchunked\b|\bpaste\b|\brecover\b/i);
	assert.equal(parsed.scenarios[0].verify.length, 1);
});
