import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { formatSharedAgentsSystemPrompt, loadSharedAgents } from "./prompt.ts";

export default function sharedAgentsExtension(pi: ExtensionAPI) {
	let sharedAgents = "";

	pi.on("session_start", async () => {
		sharedAgents = await loadSharedAgents();
	});

	pi.on("before_agent_start", async (event) => {
		const sharedAgentsPrompt = formatSharedAgentsSystemPrompt(sharedAgents);
		if (!sharedAgentsPrompt) {
			return;
		}

		return {
			systemPrompt: `${event.systemPrompt}

${sharedAgentsPrompt}`,
		};
	});
}
