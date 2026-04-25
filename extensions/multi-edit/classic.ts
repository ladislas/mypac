import { isAbsolute, resolve as resolvePath } from "path";
import { generateDiffString } from "./diff.ts";
import type { Workspace } from "./workspace.ts";

export interface EditItem {
	path: string;
	oldText: string;
	newText: string;
}

export interface EditResult {
	path: string;
	success: boolean;
	message: string;
	diff?: string;
	firstChangedLine?: number;
}

export function formatResults(results: EditResult[], totalEdits: number): string {
	const lines: string[] = [];

	for (let i = 0; i < results.length; i++) {
		const r = results[i];
		const status = r.success ? "✓" : "✗";
		lines.push(`${status} Edit ${i + 1}/${totalEdits} (${r.path}): ${r.message}`);
	}

	const remaining = totalEdits - results.length;
	if (remaining > 0) {
		lines.push(`⊘ ${remaining} remaining edit(s) skipped due to error.`);
	}

	return lines.join("\n");
}

/**
 * Apply a list of classic edits (path/oldText/newText) sequentially via a Workspace.
 *
 * When multiple edits target the same file, they are sorted by their position in
 * the original file content (top-to-bottom) before applying.  This makes the
 * operation robust regardless of the order the model listed the edits.
 *
 * A forward cursor (`searchOffset`) advances after each replacement so that
 * duplicate oldText snippets are disambiguated by position.
 */
export async function applyClassicEdits(
	edits: EditItem[],
	workspace: Workspace,
	cwd: string,
	signal?: AbortSignal,
	options?: { collectDiff?: boolean },
): Promise<EditResult[]> {
	const collectDiff = options?.collectDiff ?? false;

	// Group edits by resolved absolute path, preserving order.
	const fileGroups = new Map<string, { index: number; edit: EditItem }[]>();
	const editOrder: string[] = []; // track insertion order of keys

	for (let i = 0; i < edits.length; i++) {
		const abs = isAbsolute(edits[i].path) ? resolvePath(edits[i].path) : resolvePath(cwd, edits[i].path);
		if (!fileGroups.has(abs)) {
			fileGroups.set(abs, []);
			editOrder.push(abs);
		}
		fileGroups.get(abs)!.push({ index: i, edit: edits[i] });
	}

	const results: EditResult[] = new Array(edits.length);

	// Verify write access to all target files before mutating anything.
	for (const absPath of editOrder) {
		await workspace.checkWriteAccess(absPath);
	}

	for (const absPath of editOrder) {
		const group = fileGroups.get(absPath)!;

		if (signal?.aborted) {
			throw new Error("Operation aborted");
		}

		const originalContent = await workspace.readText(absPath);

		// Sort same-file edits by their position in the original content so that
		// the forward cursor always works, regardless of the order the model
		// listed them.  Edits whose oldText is not found sort to the end and
		// will produce an error during the apply loop below.
		if (group.length > 1) {
			const positions = new Map<{ index: number; edit: EditItem }, number>();
			for (const entry of group) {
				const pos = originalContent.indexOf(entry.edit.oldText);
				positions.set(entry, pos === -1 ? Number.MAX_SAFE_INTEGER : pos);
			}
			group.sort((a, b) => positions.get(a)! - positions.get(b)!);
		}

		let content = originalContent;
		let searchOffset = 0;

		// Track successfully applied oldText→newText pairs in this file so we
		// can detect redundant duplicate edits (model listed more replacements
		// than actual occurrences).
		const appliedPairs = new Set<string>();

		for (const { index, edit } of group) {
			if (signal?.aborted) {
				throw new Error("Operation aborted");
			}

			// Find oldText starting from the cursor position (positional ordering).
			const pos = content.indexOf(edit.oldText, searchOffset);

			if (pos === -1) {
				// If the exact same oldText→newText pair was already applied in
				// this file, the model likely just over-counted occurrences.
				// Skip gracefully instead of aborting the entire batch.
				const pairKey = `${edit.oldText}\0${edit.newText}`;
				if (appliedPairs.has(pairKey)) {
					results[index] = {
						path: edit.path,
						success: true,
						message: `Skipped redundant edit in ${edit.path} (already replaced all occurrences).`,
					};
					continue;
				}

				results[index] = {
					path: edit.path,
					success: false,
					message: `Could not find the exact text in ${edit.path}. The old text must match exactly including all whitespace and newlines.`,
				};
				// Fill remaining edits in this group as skipped.
				const filled = Array.from({ length: edits.length }, (_, i) => results[i]).filter(Boolean);
				throw new Error(formatResults(filled, edits.length));
			}

			content = content.slice(0, pos) + edit.newText + content.slice(pos + edit.oldText.length);
			searchOffset = pos + edit.newText.length;
			appliedPairs.add(`${edit.oldText}\0${edit.newText}`);

			results[index] = {
				path: edit.path,
				success: true,
				message: `Edited ${edit.path}.`,
			};
		}

		// Write back the fully-edited file.
		await workspace.writeText(absPath, content);

		// Generate a single diff for all edits to this file; attach to first edit.
		if (collectDiff) {
			const diffResult = generateDiffString(originalContent, content);
			const firstIdx = group[0].index;
			results[firstIdx].diff = diffResult.diff;
			results[firstIdx].firstChangedLine = diffResult.firstChangedLine;
		}
	}

	return results;
}
