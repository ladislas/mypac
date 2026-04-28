import path from "node:path";

export const BTW_IMPORT_TYPE = "btw-import-context";
export const BTW_SIDECHAT_STATE_TYPE = "btw-sidechat-state";
export const BTW_SIDECHAT_VERSION = 1;

export type BtwImportSource = "launch" | "refresh";

export type BtwLaunchAnchor = {
	leafId: string | null;
	timestamp: number;
};

export type BtwSidechatState = {
	version: number;
	mainSessionId: string;
	mainSessionFile?: string;
	anchor?: BtwLaunchAnchor;
	importedContext?: {
		timestamp: number;
		messageCount: number;
		source?: BtwImportSource;
	};
};

export type BtwSidechatLocation = {
	dir: string;
	file: string;
};

export type PersistedCustomEntry = {
	type: string;
	customType?: string;
	data?: unknown;
};

export type BtwRestoredState<TThread, TImport> = {
	thread: TThread[];
	importedContext: TImport | null;
	state: BtwSidechatState | null;
};

export function getBtwSidechatLocation(sessionDir: string, mainSessionId: string): BtwSidechatLocation {
	const dir = path.join(sessionDir, ".btw-sidechats", mainSessionId);
	return {
		dir,
		file: path.join(dir, "default.jsonl"),
	};
}

export function createBaseSidechatState(mainSessionId: string, mainSessionFile?: string): BtwSidechatState {
	return {
		version: BTW_SIDECHAT_VERSION,
		mainSessionId,
		mainSessionFile,
	};
}

export function normalizeSidechatState(baseState: BtwSidechatState, state: BtwSidechatState | null | undefined): BtwSidechatState {
	if (!state || typeof state !== "object") {
		return baseState;
	}

	return {
		...baseState,
		...state,
		version: BTW_SIDECHAT_VERSION,
		mainSessionId: baseState.mainSessionId,
		mainSessionFile: baseState.mainSessionFile,
	};
}

export function getImportedContextSummary<TImport extends { timestamp: number; messageCount: number; source?: BtwImportSource }>(
	details: TImport | null,
): BtwSidechatState["importedContext"] {
	if (!details) {
		return undefined;
	}

	return {
		timestamp: details.timestamp,
		messageCount: details.messageCount,
		source: details.source,
	};
}

export function restorePersistedState<
	TThread extends { question?: string; answer?: string },
	TImport extends { messages?: unknown[]; timestamp?: number; messageCount?: number; source?: BtwImportSource },
>(
	entries: readonly PersistedCustomEntry[],
	options: {
		entryType: string;
		resetType: string;
		importType: string;
		stateType: string;
	},
): BtwRestoredState<TThread, TImport> {
	let lastResetIndex = -1;
	let state: BtwSidechatState | null = null;

	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		if (entry.type !== "custom") {
			continue;
		}
		if (entry.customType === options.resetType) {
			lastResetIndex = i;
		}
		if (entry.customType === options.stateType) {
			state = entry.data as BtwSidechatState | null;
		}
	}

	const thread: TThread[] = [];
	let importedContext: TImport | null = null;

	for (const entry of entries.slice(lastResetIndex + 1)) {
		if (entry.type !== "custom") {
			continue;
		}
		if (entry.customType === options.entryType) {
			const details = entry.data as TThread | undefined;
			if (details?.question && details.answer) {
				thread.push(details);
			}
		}
		if (entry.customType === options.importType) {
			const details = entry.data as TImport | undefined;
			if (details?.messages && Array.isArray(details.messages) && typeof details.timestamp === "number") {
				importedContext = details;
			}
		}
	}

	return {
		thread,
		importedContext,
		state,
	};
}

export function resolveImportTarget(
	anchor: BtwLaunchAnchor | null,
	currentLeafId: string | null,
	hasImportedContext: boolean,
): { source: BtwImportSource; leafId: string | null } {
	if (hasImportedContext) {
		return { source: "refresh", leafId: currentLeafId };
	}

	return {
		source: "launch",
		leafId: anchor?.leafId ?? currentLeafId,
	};
}

export function getImportSourceLabel(source: BtwImportSource | null): string {
	switch (source) {
		case "launch":
			return "launch snapshot";
		case "refresh":
			return "refreshed snapshot";
		default:
			return "imported snapshot";
	}
}

export function isImportOverlayCommand(input: string): boolean {
	return input.trim() === "/import";
}

export function isPartialImportOverlayCommand(input: string): boolean {
	const t = input.trim();
	return t.startsWith("/import") && t !== "/import";
}

export function getImportOverlayHint(_hasImportedContext: boolean): string {
	return "/import main context";
}
