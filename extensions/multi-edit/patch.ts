import { isAbsolute, resolve as resolvePath } from "path";
import { generateDiffString } from "./diff.ts";
import type { Workspace } from "./workspace.ts";

export interface UpdateChunk {
	changeContext?: string;
	oldLines: string[];
	newLines: string[];
	isEndOfFile: boolean;
}

export type PatchOperation =
	| { kind: "add"; path: string; contents: string }
	| { kind: "delete"; path: string }
	| { kind: "update"; path: string; chunks: UpdateChunk[] };

export interface PatchOpResult {
	path: string;
	message: string;
	diff?: string;
	firstChangedLine?: number;
}

export function normalizeToLF(text: string): string {
	return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function resolvePatchPath(cwd: string, filePath: string): string {
	const trimmed = filePath.trim();
	if (!trimmed) {
		throw new Error("Patch path cannot be empty");
	}
	return isAbsolute(trimmed) ? resolvePath(trimmed) : resolvePath(cwd, trimmed);
}

export function ensureTrailingNewline(content: string): string {
	return content.endsWith("\n") ? content : `${content}\n`;
}

function normaliseLineForFuzzyMatch(s: string): string {
	return s
		.trim()
		.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
		.replace(/[\u2018\u2019\u201A\u201B]/g, "'")
		.replace(/[\u201C\u201D\u201E\u201F]/g, '"')
		.replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g, " ");
}

export function seekSequence(lines: string[], pattern: string[], start: number, eof: boolean): number | undefined {
	if (pattern.length === 0) return start;
	if (pattern.length > lines.length) return undefined;

	const searchStart = eof && lines.length >= pattern.length ? lines.length - pattern.length : start;
	const searchEnd = lines.length - pattern.length;

	const exactEqual = (a: string, b: string) => a === b;
	const rstripEqual = (a: string, b: string) => a.trimEnd() === b.trimEnd();
	const trimEqual = (a: string, b: string) => a.trim() === b.trim();
	const fuzzyEqual = (a: string, b: string) => normaliseLineForFuzzyMatch(a) === normaliseLineForFuzzyMatch(b);

	const passes = [exactEqual, rstripEqual, trimEqual, fuzzyEqual];

	for (const eq of passes) {
		for (let i = searchStart; i <= searchEnd; i++) {
			let ok = true;
			for (let p = 0; p < pattern.length; p++) {
				if (!eq(lines[i + p], pattern[p])) {
					ok = false;
					break;
				}
			}
			if (ok) return i;
		}
	}

	return undefined;
}

function applyReplacements(lines: string[], replacements: Array<[number, number, string[]]>): string[] {
	const next = [...lines];

	for (const [start, oldLen, newSegment] of [...replacements].sort((a, b) => b[0] - a[0])) {
		next.splice(start, oldLen, ...newSegment);
	}

	return next;
}

export function deriveUpdatedContent(filePath: string, currentContent: string, chunks: UpdateChunk[]): string {
	const originalLines = currentContent.split("\n");
	if (originalLines[originalLines.length - 1] === "") {
		originalLines.pop();
	}

	const replacements: Array<[number, number, string[]]> = [];
	let lineIndex = 0;

	for (const chunk of chunks) {
		if (chunk.changeContext !== undefined) {
			const ctxIndex = seekSequence(originalLines, [chunk.changeContext], lineIndex, false);
			if (ctxIndex === undefined) {
				throw new Error(`Failed to find context '${chunk.changeContext}' in ${filePath}`);
			}
			lineIndex = ctxIndex + 1;
		}

		if (chunk.oldLines.length === 0) {
			replacements.push([originalLines.length, 0, [...chunk.newLines]]);
			continue;
		}

		let pattern = chunk.oldLines;
		let newSlice = chunk.newLines;

		let found = seekSequence(originalLines, pattern, lineIndex, chunk.isEndOfFile);
		if (found === undefined && pattern[pattern.length - 1] === "") {
			pattern = pattern.slice(0, -1);
			if (newSlice[newSlice.length - 1] === "") {
				newSlice = newSlice.slice(0, -1);
			}
			found = seekSequence(originalLines, pattern, lineIndex, chunk.isEndOfFile);
		}

		if (found === undefined) {
			throw new Error(`Failed to find expected lines in ${filePath}:\n${chunk.oldLines.join("\n")}`);
		}

		replacements.push([found, pattern.length, [...newSlice]]);
		lineIndex = found + pattern.length;
	}

	const newLines = applyReplacements(originalLines, replacements);
	if (newLines[newLines.length - 1] !== "") {
		newLines.push("");
	}
	return newLines.join("\n");
}

function parseUpdateChunk(
	lines: string[],
	startIndex: number,
	lastContentLine: number,
	allowMissingContext: boolean,
): { chunk: UpdateChunk; nextIndex: number } {
	let i = startIndex;
	let changeContext: string | undefined;
	const first = lines[i].trimEnd();

	if (first === "@@") {
		i++;
	} else if (first.startsWith("@@ ")) {
		changeContext = first.slice(3);
		i++;
	} else if (!allowMissingContext) {
		throw new Error(`Expected update hunk to start with @@ context marker, got: '${lines[i]}'`);
	}

	const oldLines: string[] = [];
	const newLines: string[] = [];
	let parsed = 0;
	let isEndOfFile = false;

	while (i <= lastContentLine) {
		const raw = lines[i];
		const trimmed = raw.trimEnd();

		if (trimmed === "*** End of File") {
			if (parsed === 0) {
				throw new Error("Update hunk does not contain any lines");
			}
			isEndOfFile = true;
			i++;
			break;
		}

		if (parsed > 0 && (trimmed.startsWith("@@") || trimmed.startsWith("*** "))) {
			break;
		}

		if (raw.length === 0) {
			oldLines.push("");
			newLines.push("");
			parsed++;
			i++;
			continue;
		}

		const marker = raw[0];
		const body = raw.slice(1);
		if (marker === " ") {
			oldLines.push(body);
			newLines.push(body);
		} else if (marker === "-") {
			oldLines.push(body);
		} else if (marker === "+") {
			newLines.push(body);
		} else if (parsed === 0) {
			throw new Error(
				`Unexpected line found in update hunk: '${raw}'. Every line should start with ' ', '+', or '-'.`,
			);
		} else {
			break;
		}

		parsed++;
		i++;
	}

	if (parsed === 0) {
		throw new Error("Update hunk does not contain any lines");
	}

	return {
		chunk: { changeContext, oldLines, newLines, isEndOfFile },
		nextIndex: i,
	};
}

export function parsePatch(patchText: string): PatchOperation[] {
	const lines = normalizeToLF(patchText).trim().split("\n");
	if (lines.length < 2) {
		throw new Error("Patch is empty or invalid");
	}
	if (lines[0].trim() !== "*** Begin Patch") {
		throw new Error("The first line of the patch must be '*** Begin Patch'");
	}
	if (lines[lines.length - 1].trim() !== "*** End Patch") {
		throw new Error("The last line of the patch must be '*** End Patch'");
	}

	const operations: PatchOperation[] = [];
	let i = 1;
	const lastContentLine = lines.length - 2;

	while (i <= lastContentLine) {
		if (lines[i].trim() === "") {
			i++;
			continue;
		}

		const line = lines[i].trim();
		if (line.startsWith("*** Add File: ")) {
			const path = line.slice("*** Add File: ".length);
			i++;
			const contentLines: string[] = [];
			while (i <= lastContentLine) {
				const next = lines[i];
				if (next.trim().startsWith("*** ")) break;
				if (!next.startsWith("+")) {
					throw new Error(`Invalid add-file line '${next}'. Add file lines must start with '+'`);
				}
				contentLines.push(next.slice(1));
				i++;
			}
			operations.push({ kind: "add", path, contents: contentLines.length > 0 ? `${contentLines.join("\n")}\n` : "" });
			continue;
		}

		if (line.startsWith("*** Delete File: ")) {
			const path = line.slice("*** Delete File: ".length);
			operations.push({ kind: "delete", path });
			i++;
			continue;
		}

		if (line.startsWith("*** Update File: ")) {
			const path = line.slice("*** Update File: ".length);
			i++;

			if (i <= lastContentLine && lines[i].trim().startsWith("*** Move to: ")) {
				throw new Error("Patch move operations (*** Move to:) are not supported.");
			}

			const chunks: UpdateChunk[] = [];
			while (i <= lastContentLine) {
				if (lines[i].trim() === "") {
					i++;
					continue;
				}
				if (lines[i].trim().startsWith("*** ")) {
					break;
				}

				const parsed = parseUpdateChunk(lines, i, lastContentLine, chunks.length === 0);
				chunks.push(parsed.chunk);
				i = parsed.nextIndex;
			}

			if (chunks.length === 0) {
				throw new Error(`Update file hunk for path '${path}' is empty`);
			}

			operations.push({ kind: "update", path, chunks });
			continue;
		}

		throw new Error(
			`'${line}' is not a valid hunk header. Valid headers: '*** Add File:', '*** Delete File:', '*** Update File:'`,
		);
	}

	return operations;
}

export async function applyPatchOperations(
	ops: PatchOperation[],
	workspace: Workspace,
	cwd: string,
	signal?: AbortSignal,
	options?: { collectDiff?: boolean },
): Promise<PatchOpResult[]> {
	const results: PatchOpResult[] = [];
	const collectDiff = options?.collectDiff ?? false;

	for (const op of ops) {
		if (signal?.aborted) {
			throw new Error("Operation aborted");
		}

		if (op.kind === "add") {
			const abs = resolvePatchPath(cwd, op.path);
			let oldText = "";
			if (collectDiff && (await workspace.exists(abs))) {
				oldText = await workspace.readText(abs);
			}
			const newText = ensureTrailingNewline(op.contents);
			await workspace.writeText(abs, newText);
			const result: PatchOpResult = { path: op.path, message: `Added file ${op.path}.` };
			if (collectDiff) {
				const diffResult = generateDiffString(oldText, newText);
				result.diff = diffResult.diff;
				result.firstChangedLine = diffResult.firstChangedLine;
			}
			results.push(result);
			continue;
		}

		if (op.kind === "delete") {
			const abs = resolvePatchPath(cwd, op.path);
			const exists = await workspace.exists(abs);
			if (!exists) {
				throw new Error(`Failed to delete ${op.path}: file does not exist`);
			}
			let oldText = "";
			if (collectDiff) {
				oldText = await workspace.readText(abs);
			}
			await workspace.deleteFile(abs);
			const result: PatchOpResult = { path: op.path, message: `Deleted file ${op.path}.` };
			if (collectDiff) {
				const diffResult = generateDiffString(oldText, "");
				result.diff = diffResult.diff;
				result.firstChangedLine = diffResult.firstChangedLine;
			}
			results.push(result);
			continue;
		}

		const sourceAbs = resolvePatchPath(cwd, op.path);
		const sourceText = await workspace.readText(sourceAbs);
		const updated = deriveUpdatedContent(op.path, sourceText, op.chunks);

		await workspace.writeText(sourceAbs, updated);
		const result: PatchOpResult = { path: op.path, message: `Updated ${op.path}.` };
		if (collectDiff) {
			const diffResult = generateDiffString(sourceText, updated);
			result.diff = diffResult.diff;
			result.firstChangedLine = diffResult.firstChangedLine;
		}
		results.push(result);
	}

	return results;
}
