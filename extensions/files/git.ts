/**
 * Git operations and FileEntry building for the files extension.
 */
import { existsSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
	collectRecentFileReferences,
	formatDisplayPath,
	toCanonicalPath,
	toCanonicalPathMaybeMissing,
	type FileEntry,
} from "./path-utils.ts";

export type GitStatusEntry = {
	status: string;
	exists: boolean;
	isDirectory: boolean;
};

export type FileToolName = "write" | "edit";

export type SessionFileChange = {
	operations: Set<FileToolName>;
	lastTimestamp: number;
};

function splitNullSeparated(value: string): string[] {
	return value.split("\0").filter(Boolean);
}

export async function getGitRoot(pi: ExtensionAPI, cwd: string): Promise<string | null> {
	const result = await pi.exec("git", ["rev-parse", "--show-toplevel"], { cwd });
	if (result.code !== 0) {
		return null;
	}

	const root = result.stdout.trim();
	return root ? root : null;
}

export async function getGitStatusMap(
	pi: ExtensionAPI,
	cwd: string,
): Promise<Map<string, GitStatusEntry>> {
	const statusMap = new Map<string, GitStatusEntry>();
	const statusResult = await pi.exec("git", ["status", "--porcelain=1", "-z"], { cwd });
	if (statusResult.code !== 0 || !statusResult.stdout) {
		return statusMap;
	}

	const entries = splitNullSeparated(statusResult.stdout);
	for (let i = 0; i < entries.length; i += 1) {
		const entry = entries[i];
		if (!entry || entry.length < 4) continue;
		const status = entry.slice(0, 2);
		const statusLabel = status.replace(/\s/g, "") || status.trim();
		let filePath = entry.slice(3);
		if ((status.startsWith("R") || status.startsWith("C")) && entries[i + 1]) {
			filePath = entries[i + 1];
			i += 1;
		}
		if (!filePath) continue;

		const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
		const canonical = toCanonicalPathMaybeMissing(resolved);
		if (!canonical) continue;
		statusMap.set(canonical.canonicalPath, {
			status: statusLabel,
			exists: canonical.exists,
			isDirectory: canonical.isDirectory,
		});
	}

	return statusMap;
}

export async function getGitFiles(
	pi: ExtensionAPI,
	gitRoot: string,
): Promise<{ tracked: Set<string>; files: Array<{ canonicalPath: string; isDirectory: boolean }> }> {
	const tracked = new Set<string>();
	const files: Array<{ canonicalPath: string; isDirectory: boolean }> = [];

	const trackedResult = await pi.exec("git", ["ls-files", "-z"], { cwd: gitRoot });
	if (trackedResult.code === 0 && trackedResult.stdout) {
		for (const relativePath of splitNullSeparated(trackedResult.stdout)) {
			const resolvedPath = path.resolve(gitRoot, relativePath);
			const canonical = toCanonicalPath(resolvedPath);
			if (!canonical) continue;
			tracked.add(canonical.canonicalPath);
			files.push(canonical);
		}
	}

	const untrackedResult = await pi.exec(
		"git",
		["ls-files", "-z", "--others", "--exclude-standard"],
		{ cwd: gitRoot },
	);
	if (untrackedResult.code === 0 && untrackedResult.stdout) {
		for (const relativePath of splitNullSeparated(untrackedResult.stdout)) {
			const resolvedPath = path.resolve(gitRoot, relativePath);
			const canonical = toCanonicalPath(resolvedPath);
			if (!canonical) continue;
			files.push(canonical);
		}
	}

	return { tracked, files };
}

export function collectSessionFileChanges(
	entries: Parameters<typeof collectRecentFileReferences>[0],
	cwd: string,
): Map<string, SessionFileChange> {
	const toolCalls = new Map<string, { path: string; name: FileToolName }>();

	for (const entry of entries) {
		if (entry.type !== "message") continue;
		const msg = entry.message;

		if (msg.role === "assistant" && Array.isArray(msg.content)) {
			for (const block of msg.content) {
				if (block.type === "toolCall") {
					const name = block.name as FileToolName;
					if (name === "write" || name === "edit") {
						const filePath = block.arguments?.path;
						if (filePath && typeof filePath === "string") {
							toolCalls.set(block.id, { path: filePath, name });
						}
					}
				}
			}
		}
	}

	const fileMap = new Map<string, SessionFileChange>();

	for (const entry of entries) {
		if (entry.type !== "message") continue;
		const msg = entry.message;

		if (msg.role === "toolResult") {
			const toolCall = toolCalls.get(msg.toolCallId);
			if (!toolCall) continue;

			const resolvedPath = path.isAbsolute(toolCall.path)
				? toolCall.path
				: path.resolve(cwd, toolCall.path);
			const canonical = toCanonicalPath(resolvedPath);
			if (!canonical) {
				continue;
			}

			const existing = fileMap.get(canonical.canonicalPath);
			if (existing) {
				existing.operations.add(toolCall.name);
				if (msg.timestamp > existing.lastTimestamp) {
					existing.lastTimestamp = msg.timestamp;
				}
			} else {
				fileMap.set(canonical.canonicalPath, {
					operations: new Set([toolCall.name]),
					lastTimestamp: msg.timestamp,
				});
			}
		}
	}

	return fileMap;
}

export async function buildFileEntries(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
): Promise<{ files: FileEntry[]; gitRoot: string | null }> {
	const entries = ctx.sessionManager.getBranch();
	const sessionChanges = collectSessionFileChanges(entries, ctx.cwd);
	const gitRoot = await getGitRoot(pi, ctx.cwd);
	const statusMap = gitRoot
		? await getGitStatusMap(pi, gitRoot)
		: new Map<string, GitStatusEntry>();

	let trackedSet = new Set<string>();
	let gitFiles: Array<{ canonicalPath: string; isDirectory: boolean }> = [];
	if (gitRoot) {
		const gitListing = await getGitFiles(pi, gitRoot);
		trackedSet = gitListing.tracked;
		gitFiles = gitListing.files;
	}

	const fileMap = new Map<string, FileEntry>();

	const upsertFile = (
		data: Partial<FileEntry> & { canonicalPath: string; isDirectory: boolean },
	) => {
		const existing = fileMap.get(data.canonicalPath);
		const displayPath =
			data.displayPath ?? formatDisplayPath(data.canonicalPath, ctx.cwd);

		if (existing) {
			fileMap.set(data.canonicalPath, {
				...existing,
				...data,
				displayPath,
				exists: data.exists ?? existing.exists,
				isDirectory: data.isDirectory ?? existing.isDirectory,
				isReferenced: existing.isReferenced || data.isReferenced === true,
				inRepo: existing.inRepo || data.inRepo === true,
				isTracked: existing.isTracked || data.isTracked === true,
				hasSessionChange:
					existing.hasSessionChange || data.hasSessionChange === true,
				lastTimestamp: Math.max(existing.lastTimestamp, data.lastTimestamp ?? 0),
			});
			return;
		}

		fileMap.set(data.canonicalPath, {
			canonicalPath: data.canonicalPath,
			resolvedPath: data.resolvedPath ?? data.canonicalPath,
			displayPath,
			exists: data.exists ?? true,
			isDirectory: data.isDirectory,
			status: data.status,
			inRepo: data.inRepo ?? false,
			isTracked: data.isTracked ?? false,
			isReferenced: data.isReferenced ?? false,
			hasSessionChange: data.hasSessionChange ?? false,
			lastTimestamp: data.lastTimestamp ?? 0,
		});
	};

	for (const file of gitFiles) {
		upsertFile({
			canonicalPath: file.canonicalPath,
			resolvedPath: file.canonicalPath,
			isDirectory: file.isDirectory,
			exists: true,
			status: statusMap.get(file.canonicalPath)?.status,
			inRepo: true,
			isTracked: trackedSet.has(file.canonicalPath),
		});
	}

	for (const [canonicalPath, statusEntry] of statusMap.entries()) {
		if (fileMap.has(canonicalPath)) {
			continue;
		}

		const inRepo =
			gitRoot !== null &&
			!path.relative(gitRoot, canonicalPath).startsWith("..") &&
			!path.isAbsolute(path.relative(gitRoot, canonicalPath));

		upsertFile({
			canonicalPath,
			resolvedPath: canonicalPath,
			isDirectory: statusEntry.isDirectory,
			exists: statusEntry.exists,
			status: statusEntry.status,
			inRepo,
			isTracked: trackedSet.has(canonicalPath) || statusEntry.status !== "??",
		});
	}

	const references = collectRecentFileReferences(entries, ctx.cwd, 200).filter(
		(ref) => ref.exists,
	);
	for (const ref of references) {
		const canonical = toCanonicalPath(ref.path);
		if (!canonical) continue;

		const inRepo =
			gitRoot !== null &&
			!path.relative(gitRoot, canonical.canonicalPath).startsWith("..") &&
			!path.isAbsolute(path.relative(gitRoot, canonical.canonicalPath));

		upsertFile({
			canonicalPath: canonical.canonicalPath,
			resolvedPath: canonical.canonicalPath,
			isDirectory: canonical.isDirectory,
			exists: true,
			status: statusMap.get(canonical.canonicalPath)?.status,
			inRepo,
			isTracked: trackedSet.has(canonical.canonicalPath),
			isReferenced: true,
		});
	}

	for (const [canonicalPath, change] of sessionChanges.entries()) {
		const canonical = toCanonicalPath(canonicalPath);
		if (!canonical) continue;

		const inRepo =
			gitRoot !== null &&
			!path.relative(gitRoot, canonical.canonicalPath).startsWith("..") &&
			!path.isAbsolute(path.relative(gitRoot, canonical.canonicalPath));

		upsertFile({
			canonicalPath: canonical.canonicalPath,
			resolvedPath: canonical.canonicalPath,
			isDirectory: canonical.isDirectory,
			exists: true,
			status: statusMap.get(canonical.canonicalPath)?.status,
			inRepo,
			isTracked: trackedSet.has(canonical.canonicalPath),
			hasSessionChange: true,
			lastTimestamp: change.lastTimestamp,
		});
	}

	const files = Array.from(fileMap.values()).sort((a, b) => {
		const aDirty = Boolean(a.status);
		const bDirty = Boolean(b.status);
		if (aDirty !== bDirty) {
			return aDirty ? -1 : 1;
		}
		if (a.inRepo !== b.inRepo) {
			return a.inRepo ? -1 : 1;
		}
		if (a.hasSessionChange !== b.hasSessionChange) {
			return a.hasSessionChange ? -1 : 1;
		}
		if (a.lastTimestamp !== b.lastTimestamp) {
			return b.lastTimestamp - a.lastTimestamp;
		}
		if (a.isReferenced !== b.isReferenced) {
			return a.isReferenced ? -1 : 1;
		}
		return a.displayPath.localeCompare(b.displayPath);
	});

	return { files, gitRoot };
}
