import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const GIT_COMMIT = /\bgit\s+commit\b/;
const MESSAGE_ARGUMENT_WITH_LITERAL_NEWLINE = /(?:^|\s)(?:-m|--message)(?:=|\s+)(?:"[^"]*\\n[^"]*"|'[^']*\\n[^']*'|[^\s;&|]*\\n[^\s;&|]*)/;

export default function commitMessageGuardExtension(pi: ExtensionAPI): void {
	pi.on("tool_call", (event) => {
		if (event.toolName !== "bash") return;

		const command = typeof event.input.command === "string" ? event.input.command : "";
		const commitStart = command.search(GIT_COMMIT);
		if (commitStart === -1 || !MESSAGE_ARGUMENT_WITH_LITERAL_NEWLINE.test(command.slice(commitStart))) return;

		return {
			block: true,
			reason: "Blocked git commit message containing literal `\\n` text. Use multiple `-m` flags or a temporary message file so Git receives real paragraph boundaries.",
		};
	});
}
