/**
 * Undo extension - revert to the previous user message
 *
 * Works like opencode's /undo: shows a preview of the last user message,
 * asks for confirmation, then navigates back to just before it and restores
 * the text to the editor for editing. The discarded output stays in the
 * session tree as an abandoned branch. Cancelling leaves the agent untouched.
 *
 * Usage: /undo
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { UserMessage } from "@mariozechner/pi-ai";

function parseUndoContent(content: UserMessage["content"]): { text: string; hasNonTextContent: boolean } {
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

export default function (pi: ExtensionAPI) {
	pi.registerCommand("undo", {
		description: "Revert to the previous user message and restore it to the editor",
		handler: async (_args, ctx) => {
			// Walk from the leaf upward to find the most recent user message entry.
			// Do this before any abort so cancelling leaves the agent untouched.
			let current = ctx.sessionManager.getLeafEntry();
			while (current) {
				if (current.type === "message" && current.message.role === "user") {
					break;
				}
				if (!current.parentId) {
					current = undefined;
					break;
				}
				current = ctx.sessionManager.getEntry(current.parentId) ?? undefined;
			}

			if (!current) {
				ctx.ui.notify("Nothing to undo", "warning");
				return;
			}

			if (!current.parentId) {
				ctx.ui.notify("Already at the beginning, nothing to undo", "warning");
				return;
			}

			const { content } = current.message as UserMessage;
			const { text, hasNonTextContent } = parseUndoContent(content);

			if (hasNonTextContent) {
				const proceed = await ctx.ui.confirm(
					"Undo prompt with attachments?",
					text
						? "This prompt includes images or other attachments. Pi can only restore the text part to the editor, so the attachments will be lost if you continue. Proceed anyway?"
						: "This prompt includes images or other attachments and no restorable text. Pi can only restore text to the editor, so continuing will rewind the session but leave the editor empty. Proceed anyway?",
				);
				if (!proceed) {
					ctx.ui.notify("Undo cancelled", "info");
					return;
				}
			}

			// Show a preview and ask for confirmation before doing anything destructive
			const previewText = text || "(empty message)";
			const preview = previewText.length > 120 ? `${previewText.slice(0, 120)}…` : previewText;
			const confirmed = await ctx.ui.confirm("Undo last message?", `Restore to editor:\n\n${preview}`);
			if (!confirmed) {
				ctx.ui.notify("Undo cancelled", "info");
				return;
			}

			// Confirmed — now abort any in-progress run and wait for idle
			if (!ctx.isIdle()) {
				ctx.abort();
			}
			await ctx.waitForIdle();

			// Navigate to the entry just before the last user message (in-place, no summary)
			const result = await ctx.navigateTree(current.parentId, { summarize: false });
			if (result.cancelled) {
				ctx.ui.notify("Undo cancelled", "info");
				return;
			}

			// Restore the message text to the editor for editing
			ctx.ui.setEditorText(text);
			ctx.ui.notify("Undone — message restored to editor", "info");
		},
	});
}
