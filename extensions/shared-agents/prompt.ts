import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const sharedAgentsPath = path.join(packageRoot, "shared", "AGENTS.md");

export async function loadSharedAgents(): Promise<string> {
	try {
		return (await readFile(sharedAgentsPath, "utf8")).trim();
	} catch {
		return "";
	}
}

export function formatSharedAgentsSystemPrompt(sharedAgents: string): string {
	if (!sharedAgents) return "";
	return `## Shared package AGENTS.md

Treat the following instructions as additional AGENTS.md content loaded from ${sharedAgentsPath}:

${sharedAgents}`;
}
