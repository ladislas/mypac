/**
 * Pure path manipulation and file-reference extraction helpers.
 */
import { existsSync, realpathSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SessionEntry } from "@mariozechner/pi-coding-agent";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentBlock = {
	type?: string;
	text?: string;
	arguments?: Record<string, unknown>;
};

export type FileReference = {
	path: string;
	display: string;
	exists: boolean;
	isDirectory: boolean;
};

export type FileEntry = {
	canonicalPath: string;
	resolvedPath: string;
	displayPath: string;
	exists: boolean;
	isDirectory: boolean;
	status?: string;
	inRepo: boolean;
	isTracked: boolean;
	isReferenced: boolean;
	hasSessionChange: boolean;
	lastTimestamp: number;
};

// ─── Regex patterns ───────────────────────────────────────────────────────────

const FILE_TAG_REGEX = /<file\s+name=["']([^"']+)["']>/g;
const FILE_URL_REGEX = /file:\/\/[^\s"'<>]+/g;
const PATH_REGEX = /(?:^|[\s"'`([{<])((?:~|\/)[^\s"'`<>)}\]]+)/g;

// ─── Reference extraction ─────────────────────────────────────────────────────

function extractFileReferencesFromText(text: string): string[] {
	const refs: string[] = [];

	for (const match of text.matchAll(FILE_TAG_REGEX)) {
		refs.push(match[1]);
	}

	for (const match of text.matchAll(FILE_URL_REGEX)) {
		refs.push(match[0]);
	}

	for (const match of text.matchAll(PATH_REGEX)) {
		refs.push(match[1]);
	}

	return refs;
}

function extractPathsFromToolArgs(args: unknown): string[] {
	if (!args || typeof args !== "object") {
		return [];
	}

	const refs: string[] = [];
	const record = args as Record<string, unknown>;
	const directKeys = ["path", "file", "filePath", "filepath", "fileName", "filename"] as const;
	const listKeys = ["paths", "files", "filePaths"] as const;

	for (const key of directKeys) {
		const value = record[key];
		if (typeof value === "string") {
			refs.push(value);
		}
	}

	for (const key of listKeys) {
		const value = record[key];
		if (Array.isArray(value)) {
			for (const item of value) {
				if (typeof item === "string") {
					refs.push(item);
				}
			}
		}
	}

	return refs;
}

function extractFileReferencesFromContent(content: unknown): string[] {
	if (typeof content === "string") {
		return extractFileReferencesFromText(content);
	}

	if (!Array.isArray(content)) {
		return [];
	}

	const refs: string[] = [];
	for (const part of content) {
		if (!part || typeof part !== "object") {
			continue;
		}

		const block = part as ContentBlock;

		if (block.type === "text" && typeof block.text === "string") {
			refs.push(...extractFileReferencesFromText(block.text));
		}

		if (block.type === "toolCall") {
			refs.push(...extractPathsFromToolArgs(block.arguments));
		}
	}

	return refs;
}

export function extractFileReferencesFromEntry(entry: SessionEntry): string[] {
	if (entry.type === "message" && "content" in entry.message) {
		return extractFileReferencesFromContent(entry.message.content);
	}

	if (entry.type === "custom_message") {
		return extractFileReferencesFromContent(entry.content);
	}

	return [];
}

// ─── Path normalization ───────────────────────────────────────────────────────

export function sanitizeReference(raw: string): string {
	let value = raw.trim();
	value = value.replace(/^["'`(<\[]+/, "");
	value = value.replace(/[>"'`,;).\]]+$/, "");
	value = value.replace(/[.,;:]+$/, "");
	return value;
}

function isCommentLikeReference(value: string): boolean {
	return value.startsWith("//");
}

export function stripLineSuffix(value: string): string {
	let result = value.replace(/#L\d+(C\d+)?$/i, "");
	const lastSeparator = Math.max(result.lastIndexOf("/"), result.lastIndexOf("\\"));
	const segmentStart = lastSeparator >= 0 ? lastSeparator + 1 : 0;
	const segment = result.slice(segmentStart);
	const colonIndex = segment.indexOf(":");
	if (colonIndex >= 0 && /\d/.test(segment[colonIndex + 1] ?? "")) {
		result = result.slice(0, segmentStart + colonIndex);
		return result;
	}

	const lastColon = result.lastIndexOf(":");
	if (lastColon > lastSeparator) {
		const suffix = result.slice(lastColon + 1);
		if (/^\d+(?::\d+)?$/.test(suffix)) {
			result = result.slice(0, lastColon);
		}
	}
	return result;
}

export function normalizeReferencePath(raw: string, cwd: string): string | null {
	let candidate = sanitizeReference(raw);
	if (!candidate || isCommentLikeReference(candidate)) {
		return null;
	}

	if (candidate.startsWith("file://")) {
		try {
			candidate = fileURLToPath(candidate);
		} catch {
			return null;
		}
	}

	candidate = stripLineSuffix(candidate);
	if (!candidate || isCommentLikeReference(candidate)) {
		return null;
	}

	if (candidate.startsWith("~")) {
		candidate = path.join(os.homedir(), candidate.slice(1));
	}

	if (!path.isAbsolute(candidate)) {
		candidate = path.resolve(cwd, candidate);
	}

	candidate = path.normalize(candidate);
	const root = path.parse(candidate).root;
	if (candidate.length > root.length) {
		candidate = candidate.replace(/[\\/]+$/, "");
	}

	return candidate;
}

export function formatDisplayPath(absolutePath: string, cwd: string): string {
	const normalizedCwd = path.resolve(cwd);
	if (absolutePath.startsWith(normalizedCwd + path.sep)) {
		return path.relative(normalizedCwd, absolutePath);
	}

	return absolutePath;
}

// ─── Canonical path resolution ────────────────────────────────────────────────

export function toCanonicalPath(inputPath: string): { canonicalPath: string; isDirectory: boolean } | null {
	if (!existsSync(inputPath)) {
		return null;
	}

	try {
		const canonicalPath = realpathSync(inputPath);
		const stats = statSync(canonicalPath);
		return { canonicalPath, isDirectory: stats.isDirectory() };
	} catch {
		return null;
	}
}

export function toCanonicalPathMaybeMissing(
	inputPath: string,
): { canonicalPath: string; isDirectory: boolean; exists: boolean } | null {
	const resolvedPath = path.resolve(inputPath);
	if (!existsSync(resolvedPath)) {
		return { canonicalPath: path.normalize(resolvedPath), isDirectory: false, exists: false };
	}

	try {
		const canonicalPath = realpathSync(resolvedPath);
		const stats = statSync(canonicalPath);
		return { canonicalPath, isDirectory: stats.isDirectory(), exists: true };
	} catch {
		return { canonicalPath: path.normalize(resolvedPath), isDirectory: false, exists: true };
	}
}

// ─── Session reference collection ─────────────────────────────────────────────

export function collectRecentFileReferences(
	entries: SessionEntry[],
	cwd: string,
	limit: number,
): FileReference[] {
	const results: FileReference[] = [];
	const seen = new Set<string>();

	for (let i = entries.length - 1; i >= 0 && results.length < limit; i -= 1) {
		const refs = extractFileReferencesFromEntry(entries[i]);
		for (let j = refs.length - 1; j >= 0 && results.length < limit; j -= 1) {
			const normalized = normalizeReferencePath(refs[j], cwd);
			if (!normalized || seen.has(normalized)) {
				continue;
			}

			seen.add(normalized);

			let exists = false;
			let isDirectory = false;
			if (existsSync(normalized)) {
				exists = true;
				const stats = statSync(normalized);
				isDirectory = stats.isDirectory();
			}

			results.push({
				path: normalized,
				display: formatDisplayPath(normalized, cwd),
				exists,
				isDirectory,
			});
		}
	}

	return results;
}

export function findLatestFileReference(entries: SessionEntry[], cwd: string): FileReference | null {
	const refs = collectRecentFileReferences(entries, cwd, 100);
	return refs.find((ref) => ref.exists) ?? null;
}
