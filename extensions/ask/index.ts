/**
 * Ask Mode Extension
 *
 * A lightweight discussion-only mode for asking questions and thinking
 * things through mid-implementation without triggering any code changes.
 *
 * Usage:
 * - /ask to toggle ask mode on/off
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getCurrentTools } from "@earendil-works/pi-ai";
import {
	ASK_PROMPT,
	ASK_MODE_CONTEXT_TYPE,
	ASK_MODE_END,
	ASK_MODE_END_TYPE,
	ASK_MODE_STATE_TYPE,
	ASK_MODE_TOOLS,
	filterAskModeMessages,
	getAskModeStateFromBranch,
	handleAskCommand,
} from "./helpers.ts";

export default function askExtension(pi: ExtensionAPI): void {
	let askModeEnabled = false;
	let savedTools: string[] = [];

	function updateStatus(ctx: ExtensionContext): void {
		ctx.ui.setStatus("ask-mode", askModeEnabled ? ctx.ui.theme.fg("warning", "💬 ask") : undefined);
	}

	function restoreFromBranch(ctx: ExtensionContext): void {
		const branchState = getAskModeStateFromBranch(ctx.sessionManager.getBranch());
		const wasEnabled = askModeEnabled;

		if (!branchState?.enabled) {
			askModeEnabled = false;
			if (branchState?.savedTools !== undefined) {
				savedTools = [...branchState.savedTools];
			}
			if (wasEnabled) {
				pi.setActiveTools(savedTools);
			}
			updateStatus(ctx);
			return;
		}

		if (branchState.savedTools !== undefined) {
			savedTools = [...branchState.savedTools];
		} else if (!wasEnabled) {
			savedTools = pi.getActiveTools();
		}

		askModeEnabled = true;
		pi.setActiveTools(ASK_MODE_TOOLS);
		updateStatus(ctx);
	}

	function toggleAskMode(ctx: ExtensionContext): void {
		askModeEnabled = !askModeEnabled;

		if (askModeEnabled) {
			savedTools = [...pi.getActiveTools()];
			pi.appendEntry(ASK_MODE_STATE_TYPE, { enabled: true, savedTools });
			pi.setActiveTools(ASK_MODE_TOOLS);
			updateStatus(ctx);
			ctx.ui.notify("Ask mode on — no changes will be made. Use /ask to exit.");
			pi.sendMessage(
				{ customType: ASK_MODE_CONTEXT_TYPE, content: ASK_PROMPT, display: false },
				{ triggerTurn: false },
			);
		} else {
			pi.appendEntry(ASK_MODE_STATE_TYPE, { enabled: false, savedTools });
			pi.setActiveTools(savedTools);
			updateStatus(ctx);
			ctx.ui.notify("Ask mode off — full access restored.");
			// Explicit end marker so the model sees the mode change in context
			// and is not confused by its own earlier "I won't make changes" responses.
			pi.sendMessage(
				{ customType: ASK_MODE_END_TYPE, content: ASK_MODE_END, display: false },
				{ triggerTurn: false },
			);
		}
	}

	pi.registerCommand("ask", {
		description: "Toggle ask mode or ask a question in discussion mode",
		handler: async (args, ctx) => {
			handleAskCommand(askModeEnabled, args, {
				enterAskMode: () => toggleAskMode(ctx),
				exitAskMode: () => toggleAskMode(ctx),
				sendUserMessage: (message) => pi.sendUserMessage(message),
			});
		},
	});

	// When ask mode is off, remove the extension's hidden ask-mode injections
	// from context so stale restriction markers do not bleed into normal turns.
	// The [ASK MODE ENDED] marker is intentionally kept — it helps the model
	// understand the mode transition.
	pi.on("context", async (event) => {
		if (askModeEnabled) return;
		return { messages: filterAskModeMessages(event.messages) };
	});

	// MCP servers may register direct tools after Ask mode was enabled. Reassert
	// before each turn, before Pi snapshots the provider request loadout.
	pi.on("before_agent_start", async () => {
		if (askModeEnabled) pi.setActiveTools(ASK_MODE_TOOLS);
	});

	// Session replay can restore tool declarations even after active tools are
	// restricted. Remove them from the request-local transcript as well.
	pi.on("context_with_system", async (event) => {
		if (!askModeEnabled) return;
		const toolsRemoved = getCurrentTools(event.messages)
			.filter(({ name }) => !ASK_MODE_TOOLS.includes(name))
			.map(({ name }) => ({ name }));
		if (toolsRemoved.length) {
			return { messages: [...event.messages, { role: "system", content: "", toolsRemoved, timestamp: Date.now() }] };
		}
	});

	// Also block an already-issued or nested call if registration races a turn.
	pi.on("tool_call", async (event) => {
		if (askModeEnabled && !ASK_MODE_TOOLS.includes(event.toolName)) {
			return { block: true, reason: "Ask mode permits read only" };
		}
	});

	pi.on("session_start", async (_event, ctx) => {
		restoreFromBranch(ctx);
	});

	pi.on("session_tree", async (_event, ctx) => {
		restoreFromBranch(ctx);
	});
}
