/**
 * Files Extension
 * Original source: https://github.com/mitsuhiko/agent-stuff/blob/main/extensions/files.ts
 *
 * /files command lists files in the current git tree (plus session-referenced files)
 * and offers quick actions like reveal, open, edit, or diff.
 * /diff is kept as an alias to the same picker.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { buildFileEntries } from "./git.ts";
import {
	toCanonicalPath,
	findLatestFileReference,
} from "./path-utils.ts";
import {
	getEditableContent,
	openPath,
	editPath,
	revealPath,
	quickLookPath,
	openDiff,
	addFileToPrompt,
	showActionSelector,
	showFileSelector,
} from "./components.ts";

async function runFileBrowser(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
	if (!ctx.hasUI) {
		ctx.ui.notify("Files requires interactive mode", "error");
		return;
	}

	const { files, gitRoot } = await buildFileEntries(pi, ctx);
	if (files.length === 0) {
		ctx.ui.notify("No files found", "info");
		return;
	}

	let lastSelectedPath: string | null = null;
	while (true) {
		const { selected, quickAction } = await showFileSelector(
			ctx,
			files,
			lastSelectedPath,
			gitRoot,
		);
		if (!selected) {
			ctx.ui.notify("Files cancelled", "info");
			return;
		}

		lastSelectedPath = selected.canonicalPath;

		const canQuickLook = process.platform === "darwin" && !selected.isDirectory;
		const editCheck = getEditableContent(selected);
		const canDiff = selected.isTracked && !selected.isDirectory && Boolean(gitRoot);

		if (quickAction === "diff") {
			await openDiff(pi, ctx, selected, gitRoot);
			continue;
		}

		const action = await showActionSelector(ctx, {
			canQuickLook,
			canEdit: editCheck.allowed,
			canDiff,
		});
		if (!action) {
			continue;
		}

		switch (action) {
			case "quicklook":
				await quickLookPath(pi, ctx, selected);
				break;
			case "open":
				await openPath(pi, ctx, selected);
				break;
			case "edit":
				if (!editCheck.allowed || editCheck.content === undefined) {
					ctx.ui.notify(editCheck.reason ?? "File cannot be edited", "warning");
					break;
				}
				await editPath(ctx, selected, editCheck.content);
				break;
			case "addToPrompt":
				addFileToPrompt(ctx, selected);
				break;
			case "diff":
				await openDiff(pi, ctx, selected, gitRoot);
				break;
			default:
				await revealPath(pi, ctx, selected);
				break;
		}
	}
}

export default function (pi: ExtensionAPI): void {
	pi.registerCommand("files", {
		description: "Browse files with git status and session references",
		handler: async (_args, ctx) => {
			await runFileBrowser(pi, ctx);
		},
	});

	pi.registerShortcut("ctrl+shift+o", {
		description: "Browse files mentioned in the session",
		handler: async (ctx) => {
			await runFileBrowser(pi, ctx);
		},
	});

	pi.registerShortcut("ctrl+shift+f", {
		description: "Reveal the latest file reference in Finder",
		handler: async (ctx) => {
			const entries = ctx.sessionManager.getBranch();
			const latest = findLatestFileReference(entries, ctx.cwd);

			if (!latest) {
				ctx.ui.notify("No file reference found in the session", "warning");
				return;
			}

			const canonical = toCanonicalPath(latest.path);
			if (!canonical) {
				ctx.ui.notify(`File not found: ${latest.display}`, "error");
				return;
			}

			await revealPath(pi, ctx, {
				canonicalPath: canonical.canonicalPath,
				resolvedPath: canonical.canonicalPath,
				displayPath: latest.display,
				exists: true,
				isDirectory: canonical.isDirectory,
				status: undefined,
				inRepo: false,
				isTracked: false,
				isReferenced: true,
				hasSessionChange: false,
				lastTimestamp: 0,
			});
		},
	});

	pi.registerShortcut("ctrl+shift+r", {
		description: "Quick Look the latest file reference",
		handler: async (ctx) => {
			const entries = ctx.sessionManager.getBranch();
			const latest = findLatestFileReference(entries, ctx.cwd);

			if (!latest) {
				ctx.ui.notify("No file reference found in the session", "warning");
				return;
			}

			const canonical = toCanonicalPath(latest.path);
			if (!canonical) {
				ctx.ui.notify(`File not found: ${latest.display}`, "error");
				return;
			}

			await quickLookPath(pi, ctx, {
				canonicalPath: canonical.canonicalPath,
				resolvedPath: canonical.canonicalPath,
				displayPath: latest.display,
				exists: true,
				isDirectory: canonical.isDirectory,
				status: undefined,
				inRepo: false,
				isTracked: false,
				isReferenced: true,
				hasSessionChange: false,
				lastTimestamp: 0,
			});
		},
	});
}
