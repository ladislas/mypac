import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseManifest } from "../../scripts/pac-eval.ts";

const root = new URL("./", import.meta.url);

// Manifest validity is a structural contract; recovery behavior requires a separate agent evaluation.
test("CCR recovery manifest passes harness validation", async () => {
	parseManifest(JSON.parse(await readFile(new URL("manifest.json", root), "utf8")), fileURLToPath(root));
});
