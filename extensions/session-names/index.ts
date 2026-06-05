import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildWorkflowSessionName, extractSlashCommandArgument } from "./helpers.ts";

const WORKFLOW_COMMANDS = [
	{ command: "pac-llat", workflow: "llat" },
	{ command: "pac-lwot", workflow: "lwot" },
] as const;

export default function sessionNamesExtension(pi: ExtensionAPI): void {
	pi.on("input", async (event) => {
		if (event.source === "extension") {
			return { action: "continue" };
		}

		for (const { command, workflow } of WORKFLOW_COMMANDS) {
			const input = extractSlashCommandArgument(event.text, command);
			if (input === null) continue;

			const sessionName = buildWorkflowSessionName(workflow, input);
			if (sessionName) {
				pi.setSessionName(sessionName);
			}
			return { action: "continue" };
		}

		return { action: "continue" };
	});
}
