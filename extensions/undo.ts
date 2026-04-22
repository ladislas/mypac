/**
 * Undo extension - revert to the previous user message
 *
 * Works like opencode's /undo: navigates back to just before the last user
 * message in the current branch and restores its text to the editor for editing.
 * The discarded output stays in the session tree as an abandoned branch.
 *
 * Usage: /undo
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.registerCommand("undo", {
		description: "Revert to the previous user message and restore it to the editor",
		handler: async (_args, ctx) => {
			// Abort any in-progress agent run, then wait until idle
			if (!ctx.isIdle()) {
				ctx.abort();
			}
			await ctx.waitForIdle();

			// Walk from the leaf upward to find the most recent user message entry
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

			// Extract the text from the user message content
			const { content } = current.message as { content: string | Array<{ type: string; text?: string }> };
			const text =
				typeof content === "string"
					? content
					: (content as Array<{ type: string; text?: string }>)
							.filter((c) => c.type === "text" && typeof c.text === "string")
							.map((c) => c.text as string)
							.join("\n");

			// Navigate to the entry just before the last user message (in-place, no summary)
			const result = await ctx.navigateTree(current.parentId, { summarize: false });
			if (result.cancelled) {
				ctx.ui.notify("Undo cancelled", "info");
				return;
			}

			// Restore the message text to the editor for editing
			ctx.ui.setEditorText(text);
			ctx.ui.notify("Undone — message restored to editor", "success");
		},
	});
}
