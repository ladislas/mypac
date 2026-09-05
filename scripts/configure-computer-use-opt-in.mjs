import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const specification = process.argv[2];
if (!specification) throw new Error("computer-use package specification is required");

const agentDir = process.env.PI_CODING_AGENT_DIR || join(process.env.HOME, ".pi", "agent");
const settingsPath = join(agentDir, "settings.json");
const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
const packages = settings.packages ?? [];
const index = packages.findIndex((entry) =>
	(typeof entry === "string" ? entry : entry.source) === specification,
);

if (index === -1) {
	throw new Error(`${specification} is not registered in ${settingsPath}`);
}

const current = packages[index];
packages[index] = {
	...(typeof current === "string" ? { source: current } : current),
	extensions: [],
};
settings.packages = packages;

const temporaryPath = join(dirname(settingsPath), `.settings.json.${process.pid}.tmp`);
writeFileSync(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`);
renameSync(temporaryPath, settingsPath);
