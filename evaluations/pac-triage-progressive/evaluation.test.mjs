import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parseManifest } from "../../scripts/pac-eval.ts";

// Validate the runnable manifest, not its model choice or scenario prose.
test("triage progression manifest passes harness validation", async () => {
	const directory = new URL("./", import.meta.url);
	parseManifest(JSON.parse(await readFile(new URL("manifest.json", directory), "utf8")), fileURLToPath(directory));
});
