import type { UserMessage } from "@mariozechner/pi-ai";

export function parseUndoContent(content: UserMessage["content"]): { text: string; hasNonTextContent: boolean } {
	if (typeof content === "string") {
		return { text: content, hasNonTextContent: false };
	}

	const text: string[] = [];
	let hasNonTextContent = false;

	for (const part of content) {
		if (part.type === "text") {
			text.push(part.text);
		} else {
			hasNonTextContent = true;
		}
	}

	return { text: text.join("\n"), hasNonTextContent };
}
