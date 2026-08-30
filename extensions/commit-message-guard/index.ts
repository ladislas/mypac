import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SHELL_WORD = String.raw`(?:"[^"]*"|'[^']*'|[^\s;&|]+)`;
const GIT_GLOBAL_OPTION = [
	String.raw`(?:-C|-c)\s+${SHELL_WORD}`,
	String.raw`(?:--git-dir|--work-tree|--namespace|--super-prefix|--config-env|--attr-source)(?:=|\s+)${SHELL_WORD}`,
	String.raw`--exec-path(?:=${SHELL_WORD})?`,
	String.raw`(?:-p|-P|--paginate|--no-pager|--bare|--no-replace-objects|--literal-pathspecs|--glob-pathspecs|--noglob-pathspecs|--icase-pathspecs|--no-optional-locks|--no-lazy-fetch)`,
].join("|");
const GIT_COMMIT = new RegExp(String.raw`\bgit(?:\s+(?:${GIT_GLOBAL_OPTION}))*\s+commit\b`);
const MESSAGE_ARGUMENT_WITH_LITERAL_NEWLINE = /(?:^|\s)(?:-m(?:=|\s+)?|--message(?:=|\s+))(?:"[^"]*\\n[^"]*"|'[^']*\\n[^']*'|[^\s;&|]*\\n[^\s;&|]*)/;

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
