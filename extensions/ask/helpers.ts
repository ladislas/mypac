/**
 * Pure helper functions for ask mode.
 * Extracted for testability.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";

export const ASK_MODE_TOOLS = ["read"];
export const ASK_MODE_CONTEXT_TYPE = "ask-mode-context";
export const ASK_MODE_END_TYPE = "ask-mode-end";
export const ASK_MODE_STATE_TYPE = "ask-mode-state";

export const ASK_PROMPT = `[ASK MODE ACTIVE]
The user wants to discuss or ask a question. Do not take any action.

Rules — follow all of them strictly:
- Do NOT edit or write any files
- Do NOT run any shell commands
- Do NOT make any code changes
- Just answer, discuss, and think things through conversationally

Stay in this mode until the user exits with /ask.`;

export const ASK_MODE_END = `[ASK MODE ENDED]
Ask mode is off. You have full tool access again (read, bash, edit, write). Proceed normally.`;

type AugmentedMessage = AgentMessage & { customType?: string };

type AskModeStateEntry = {
	type: string;
	customType?: string;
	data?: unknown;
};

export interface AskModeState {
	enabled: boolean;
	savedTools?: string[];
}

export interface AskCommandHandlers {
	enterAskMode(): void;
	exitAskMode(): void;
	sendUserMessage(message: string): void;
}

export function handleAskCommand(
	askModeEnabled: boolean,
	args: string | undefined,
	handlers: AskCommandHandlers,
): void {
	const question = args?.trim();

	if (askModeEnabled) {
		handlers.exitAskMode();
	} else {
		handlers.enterAskMode();
	}

	if (question) {
		handlers.sendUserMessage(question);
	}
}

function parseAskModeState(data: unknown): AskModeState {
	if (!data || typeof data !== "object") {
		throw new Error("Invalid ask-mode state: expected object data");
	}

	const { enabled, savedTools } = data as { enabled?: unknown; savedTools?: unknown };
	if (typeof enabled !== "boolean") {
		throw new Error("Invalid ask-mode state: expected boolean enabled flag");
	}
	if (!Array.isArray(savedTools) || savedTools.some((tool) => typeof tool !== "string")) {
		throw new Error("Invalid ask-mode state: expected savedTools string[]");
	}

	return { enabled, savedTools };
}

export function getAskModeStateFromBranch(entries: AskModeStateEntry[]): AskModeState | undefined {
	let state: AskModeState | undefined;

	for (const entry of entries) {
		if (entry.type === "custom" && entry.customType === ASK_MODE_STATE_TYPE) {
			state = parseAskModeState(entry.data);
			continue;
		}

		if (entry.type !== "custom_message") {
			continue;
		}

		if (entry.customType === ASK_MODE_CONTEXT_TYPE) {
			state = { enabled: true, savedTools: state?.savedTools };
			continue;
		}

		if (entry.customType === ASK_MODE_END_TYPE) {
			state = { enabled: false, savedTools: state?.savedTools };
		}
	}

	return state;
}

/**
 * Removes ask-mode-context injections from the message list.
 * Called when ask mode is off to prevent old "I won't make changes" markers
 * from bleeding into normal turns.
 *
 * The [ASK MODE ENDED] marker (ask-mode-end) is intentionally kept —
 * it helps the model understand the mode transition.
 */
export function filterAskModeMessages(messages: AgentMessage[]): AgentMessage[] {
	return messages.filter((m) => {
		const msg = m as AugmentedMessage;
		return msg.customType !== ASK_MODE_CONTEXT_TYPE;
	});
}
