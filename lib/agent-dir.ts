import os from "node:os";
import path from "node:path";

export function resolveAgentDir(env: NodeJS.ProcessEnv = process.env, homeDir: string = os.homedir()): string {
	const envCandidates = ["PI_CODING_AGENT_DIR", "TAU_CODING_AGENT_DIR"];
	let agentDir: string | undefined;

	for (const key of envCandidates) {
		if (env[key]) {
			agentDir = env[key];
			break;
		}
	}

	if (!agentDir) {
		for (const [key, value] of Object.entries(env)) {
			if (key.endsWith("_CODING_AGENT_DIR") && value) {
				agentDir = value;
				break;
			}
		}
	}

	if (!agentDir) return path.join(homeDir, ".pi", "agent");
	if (agentDir === "~") return homeDir;
	if (agentDir.startsWith("~/")) return path.join(homeDir, agentDir.slice(2));
	return path.resolve(agentDir);
}

export function getSessionRoot(env: NodeJS.ProcessEnv = process.env, homeDir: string = os.homedir()): string {
	return path.join(resolveAgentDir(env, homeDir), "sessions");
}
