import { constants } from "fs";
import { access as fsAccess, readFile as fsReadFile, unlink as fsUnlink, writeFile as fsWriteFile } from "fs/promises";

export interface Workspace {
	readText: (absolutePath: string) => Promise<string>;
	writeText: (absolutePath: string, content: string) => Promise<void>;
	deleteFile: (absolutePath: string) => Promise<void>;
	exists: (absolutePath: string) => Promise<boolean>;
	/** Check that the file is writable. Rejects if not. No-op on virtual workspaces. */
	checkWriteAccess: (absolutePath: string) => Promise<void>;
}

export function createRealWorkspace(): Workspace {
	return {
		readText: (absolutePath) => fsReadFile(absolutePath, "utf-8"),
		writeText: (absolutePath, content) => fsWriteFile(absolutePath, content, "utf-8"),
		deleteFile: (absolutePath) => fsUnlink(absolutePath),
		exists: async (absolutePath) => {
			try {
				await fsAccess(absolutePath, constants.F_OK);
				return true;
			} catch {
				return false;
			}
		},
		checkWriteAccess: (absolutePath) => fsAccess(absolutePath, constants.R_OK | constants.W_OK),
	};
}

export function createVirtualWorkspace(cwd: string): Workspace {
	const state = new Map<string, string | null>();

	async function ensureLoaded(absolutePath: string): Promise<void> {
		if (state.has(absolutePath)) return;
		try {
			const content = await fsReadFile(absolutePath, "utf-8");
			state.set(absolutePath, content);
		} catch {
			state.set(absolutePath, null);
		}
	}

	return {
		readText: async (absolutePath) => {
			await ensureLoaded(absolutePath);
			const content = state.get(absolutePath);
			if (content === null || content === undefined) {
				throw new Error(`File not found: ${absolutePath.replace(`${cwd}/`, "")}`);
			}
			return content;
		},
		writeText: async (absolutePath, content) => {
			state.set(absolutePath, content);
		},
		deleteFile: async (absolutePath) => {
			await ensureLoaded(absolutePath);
			if (state.get(absolutePath) === null) {
				throw new Error(`File not found: ${absolutePath.replace(`${cwd}/`, "")}`);
			}
			state.set(absolutePath, null);
		},
		exists: async (absolutePath) => {
			await ensureLoaded(absolutePath);
			return state.get(absolutePath) !== null;
		},
		checkWriteAccess: async () => {
			// No-op for virtual workspace — permission checks happen on the real pass.
		},
	};
}
