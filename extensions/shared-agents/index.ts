import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sharedAgentsPath = path.join(packageRoot, "shared", "AGENTS.md");

export default function sharedAgentsExtension(pi: ExtensionAPI) {
	let sharedAgents = "";

	pi.on("session_start", async () => {
		try {
			sharedAgents = (await readFile(sharedAgentsPath, "utf8")).trim();
		} catch {
			sharedAgents = "";
		}
	});

	pi.on("before_agent_start", async (event) => {
		if (!sharedAgents) {
			return;
		}

		return {
			systemPrompt: `${event.systemPrompt}

## Shared package AGENTS.md

Treat the following instructions as additional AGENTS.md content loaded from ${sharedAgentsPath}:

${sharedAgents}`,
		};
	});
}
