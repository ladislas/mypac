import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SHELL_WORD = String.raw`(?:"[^"]*"|'[^']*'|[^\s;&|]+)`;
const GIT_GLOBAL_OPTION = [
	String.raw`(?:-C|-c)\s+${SHELL_WORD}`,
	String.raw`(?:--git-dir|--work-tree|--namespace|--super-prefix|--config-env|--attr-source)\s+${SHELL_WORD}`,
	String.raw`--[A-Za-z0-9][A-Za-z0-9-]*(?:=${SHELL_WORD})?`,
	String.raw`-[A-Za-z]+`,
].join("|");
const GIT_COMMIT = new RegExp(String.raw`^(?:\s|\\\r?\n)*git(?:\s+(?:${GIT_GLOBAL_OPTION}))*\s+commit\b`);
const MESSAGE_ARGUMENT_WITH_LITERAL_NEWLINE = /(?:^|\s)(?:-m(?:=|\s+)?|--message(?:=|\s+))(?:"[^"]*\\n[^"]*"|'[^']*\\n[^']*'|[^\s;&|]*\\n[^\s;&|]*)/;

function getShellCommandSegments(command: string): string[] {
	const segments: string[] = [];
	let start = 0;
	let quote: "'" | '"' | undefined;

	for (let index = 0; index < command.length; index += 1) {
		const character = command[index];
		if (quote) {
			if (quote === '"' && character === "\\") index += 1;
			else if (character === quote) quote = undefined;
			continue;
		}
		if (character === "'" || character === '"') quote = character;
		else if (character === "\\") index += 1;
		else if (character === ";" || character === "\n" || character === "|" || character === "&") {
			segments.push(command.slice(start, index));
			start = index + 1;
		}
	}

	segments.push(command.slice(start));
	return segments;
}

export default function commitMessageGuardExtension(pi: ExtensionAPI): void {
	pi.on("tool_call", (event) => {
		if (event.toolName !== "bash") return;

		const command = typeof event.input.command === "string" ? event.input.command : "";
		const hasMalformedCommit = getShellCommandSegments(command).some(
			(segment) => GIT_COMMIT.test(segment) && MESSAGE_ARGUMENT_WITH_LITERAL_NEWLINE.test(segment),
		);
		if (!hasMalformedCommit) return;

		return {
			block: true,
			reason: "Blocked git commit message containing literal `\\n` text. Use multiple `-m` flags or a temporary message file so Git receives real paragraph boundaries.",
		};
	});
}
