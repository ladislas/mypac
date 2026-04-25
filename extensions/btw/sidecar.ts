import path from "node:path";

export const BTW_IMPORT_TYPE = "btw-import-context";
export const BTW_SIDECAR_STATE_TYPE = "btw-sidecar-state";
export const BTW_SIDECAR_VERSION = 1;

export type BtwImportSource = "legacy" | "launch" | "refresh";

export type BtwLaunchAnchor = {
	leafId: string | null;
	timestamp: number;
};

export type BtwSidecarState = {
	version: number;
	mainSessionId: string;
	mainSessionFile?: string;
	anchor?: BtwLaunchAnchor;
	importedContext?: {
		timestamp: number;
		messageCount: number;
		source?: BtwImportSource;
	};
	migratedFromInlineAt?: number;
};

export type BtwSidecarLocation = {
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
	state: BtwSidecarState | null;
	hasLegacyEntries: boolean;
};

export function getBtwSidecarLocation(sessionDir: string, mainSessionId: string): BtwSidecarLocation {
	const dir = path.join(sessionDir, ".btw-sidecars", mainSessionId);
	return {
		dir,
		file: path.join(dir, "default.jsonl"),
	};
}

export function createBaseSidecarState(mainSessionId: string, mainSessionFile?: string): BtwSidecarState {
	return {
		version: BTW_SIDECAR_VERSION,
		mainSessionId,
		mainSessionFile,
	};
}

export function normalizeSidecarState(baseState: BtwSidecarState, state: BtwSidecarState | null | undefined): BtwSidecarState {
	if (!state || typeof state !== "object") {
		return baseState;
	}

	return {
		...baseState,
		...state,
		version: BTW_SIDECAR_VERSION,
		mainSessionId: baseState.mainSessionId,
		mainSessionFile: baseState.mainSessionFile,
	};
}

export function getImportedContextSummary<TImport extends { timestamp: number; messageCount: number; source?: BtwImportSource }>(
	details: TImport | null,
): BtwSidecarState["importedContext"] {
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
	let hasLegacyEntries = false;
	let state: BtwSidecarState | null = null;

	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		if (entry.type !== "custom") {
			continue;
		}
		if (entry.customType === options.resetType) {
			hasLegacyEntries = true;
			lastResetIndex = i;
		}
		if (entry.customType === options.entryType || entry.customType === options.importType) {
			hasLegacyEntries = true;
		}
		if (entry.customType === options.stateType) {
			state = entry.data as BtwSidecarState | null;
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
		hasLegacyEntries,
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
		case "legacy":
			return "restored snapshot";
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
