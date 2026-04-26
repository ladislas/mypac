import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { buildWorkflowSessionName, extractSlashCommandArgument } from "./helpers.ts";

export default function sessionNamesExtension(pi: ExtensionAPI): void {
	pi.on("input", async (event) => {
		if (event.source === "extension") {
			return { action: "continue" };
		}

		const input = extractSlashCommandArgument(event.text, "pac-lwot");
		if (input === null) {
			return { action: "continue" };
		}

		const sessionName = buildWorkflowSessionName("lwot", input);
		if (sessionName) {
			pi.setSessionName(sessionName);
		}

		return { action: "continue" };
	});
}
