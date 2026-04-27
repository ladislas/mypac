import path from "node:path";
import { promises as fs } from "node:fs";
import { getAgentDir, type SessionEntry } from "@mariozechner/pi-coding-agent";

export type ThinkingLevelSetting = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export type ModelDefaults = {
	defaultProvider?: string;
	defaultModel?: string;
	defaultThinkingLevel?: ThinkingLevelSetting;
};

export type ScopedModelDefaults = {
	repo: ModelDefaults;
	global: ModelDefaults;
	effective: ModelDefaults;
};

export type SettingsScope = "repo" | "global";

export type SessionStateEntryIds = {
	modelEntryId?: string;
	thinkingEntryId?: string;
};

type JsonObject = Record<string, unknown>;

type ActiveModelLike = {
	provider: string;
	id: string;
};

const SETTINGS_JSON_INDENT = 2;

export function getRepoSettingsPath(cwd: string): string {
	return path.join(cwd, ".pi", "settings.json");
}

export function getGlobalSettingsPath(agentDir = getAgentDir()): string {
	return path.join(agentDir, "settings.json");
}

export async function readScopedModelDefaults(cwd: string, agentDir = getAgentDir()): Promise<ScopedModelDefaults> {
	const [repoSettings, globalSettings] = await Promise.all([
		readSettingsFile(getRepoSettingsPath(cwd)),
		readSettingsFile(getGlobalSettingsPath(agentDir)),
	]);

	const repo = pickModelDefaults(repoSettings);
	const global = pickModelDefaults(globalSettings);

	return {
		repo,
		global,
		effective: resolveEffectiveModelDefaults({ repo, global }),
	};
}

export function pickModelDefaults(settings: JsonObject | undefined): ModelDefaults {
	return {
		defaultProvider: typeof settings?.defaultProvider === "string" ? settings.defaultProvider : undefined,
		defaultModel: typeof settings?.defaultModel === "string" ? settings.defaultModel : undefined,
		defaultThinkingLevel: isThinkingLevel(settings?.defaultThinkingLevel) ? settings.defaultThinkingLevel : undefined,
	};
}

export function resolveEffectiveModelDefaults(scoped: { repo: ModelDefaults; global: ModelDefaults }): ModelDefaults {
	const repoHasModelPair = hasCompleteModelPair(scoped.repo);
	const globalHasModelPair = hasCompleteModelPair(scoped.global);

	return {
		defaultProvider: repoHasModelPair
			? scoped.repo.defaultProvider
			: globalHasModelPair
				? scoped.global.defaultProvider
				: undefined,
		defaultModel: repoHasModelPair
			? scoped.repo.defaultModel
			: globalHasModelPair
				? scoped.global.defaultModel
				: undefined,
		defaultThinkingLevel: scoped.repo.defaultThinkingLevel ?? scoped.global.defaultThinkingLevel,
	};
}

export async function writeScopedModelDefaults(
	cwd: string,
	scope: SettingsScope,
	defaults: ModelDefaults,
	agentDir = getAgentDir(),
): Promise<void> {
	const settingsPath = scope === "repo" ? getRepoSettingsPath(cwd) : getGlobalSettingsPath(agentDir);
	const currentSettings = await readSettingsFile(settingsPath);
	const nextSettings = applyModelDefaults(currentSettings, defaults);
	await writeSettingsFile(settingsPath, nextSettings);
}

export async function restoreScopedModelDefaults(
	cwd: string,
	savedDefaults: ScopedModelDefaults,
	agentDir = getAgentDir(),
): Promise<void> {
	await Promise.all([
		writeScopedModelDefaults(cwd, "repo", savedDefaults.repo, agentDir),
		writeScopedModelDefaults(cwd, "global", savedDefaults.global, agentDir),
	]);
}

export function currentSessionDefaults(model: ActiveModelLike, thinkingLevel: ThinkingLevelSetting): ModelDefaults {
	return {
		defaultProvider: model.provider,
		defaultModel: model.id,
		defaultThinkingLevel: thinkingLevel,
	};
}

export function getLatestSessionStateEntryIds(entries: readonly SessionEntry[]): SessionStateEntryIds {
	let modelEntryId: string | undefined;
	let thinkingEntryId: string | undefined;

	for (let index = entries.length - 1; index >= 0; index -= 1) {
		const entry = entries[index];
		if (!modelEntryId && entry.type === "model_change") {
			modelEntryId = entry.id;
		}
		if (!thinkingEntryId && entry.type === "thinking_level_change") {
			thinkingEntryId = entry.id;
		}
		if (modelEntryId && thinkingEntryId) {
			break;
		}
	}

	return { modelEntryId, thinkingEntryId };
}

export function didSessionStateChange(previous: SessionStateEntryIds, next: SessionStateEntryIds): boolean {
	return previous.modelEntryId !== next.modelEntryId || previous.thinkingEntryId !== next.thinkingEntryId;
}

export type ActiveModelInfo = { provider: string; modelId: string } | null;

/**
 * Return the active model from the latest model_change entry on the branch,
 * or null if no model_change entry exists yet.
 */
export function getActiveModelFromBranch(entries: readonly SessionEntry[]): ActiveModelInfo {
	for (let i = entries.length - 1; i >= 0; i -= 1) {
		const entry = entries[i];
		if (entry.type === "model_change") {
			return { provider: entry.provider, modelId: entry.modelId };
		}
	}
	return null;
}

/**
 * Merge on-disk defaults into the saved snapshot to avoid overwriting explicit
 * saves made by another concurrent session.
 *
 * For the model pair:
 *   - If disk shows the active session model, pi's setModel() wrote it → keep the
 *     saved snapshot so we can restore it on the next sync.
 *   - Otherwise another session explicitly saved new defaults → adopt disk values.
 *
 * For thinking level:
 *   - pi's setModel() never writes defaultThinkingLevel to settings, so any change
 *     is always an external explicit save → always adopt from disk.
 */
export function refreshSavedDefaultsFromDisk(
	saved: ScopedModelDefaults,
	disk: ScopedModelDefaults,
	activeModel: ActiveModelInfo,
): ScopedModelDefaults {
	const newRepo = refreshScopeDefaults(saved.repo, disk.repo, activeModel);
	const newGlobal = refreshScopeDefaults(saved.global, disk.global, activeModel);
	if (newRepo === saved.repo && newGlobal === saved.global) {
		return saved;
	}
	return {
		repo: newRepo,
		global: newGlobal,
		effective: resolveEffectiveModelDefaults({ repo: newRepo, global: newGlobal }),
	};
}

function refreshScopeDefaults(
	saved: ModelDefaults,
	disk: ModelDefaults,
	activeModel: ActiveModelInfo,
): ModelDefaults {
	// Thinking level: pi never writes this; any disk change is an explicit external save.
	const thinkingLevel = disk.defaultThinkingLevel;

	// Model pair: check whether disk reflects pi's write (active session model) or
	// an external explicit save.
	const diskHasSessionModel =
		activeModel !== null &&
		disk.defaultProvider === activeModel.provider &&
		disk.defaultModel === activeModel.modelId;

	const savedHasSessionModel =
		activeModel !== null &&
		saved.defaultProvider === activeModel.provider &&
		saved.defaultModel === activeModel.modelId;

	let provider: string | undefined;
	let model: string | undefined;

	if (diskHasSessionModel && !savedHasSessionModel) {
		// pi wrote the active session model to disk; keep the saved snapshot
		// so the next restore undoes it correctly.
		provider = saved.defaultProvider;
		model = saved.defaultModel;
	} else {
		// Disk model pair unchanged, or external explicit save detected → adopt disk.
		provider = disk.defaultProvider;
		model = disk.defaultModel;
	}

	// Return the same object if nothing actually changed (avoids unnecessary writes).
	if (
		provider === saved.defaultProvider &&
		model === saved.defaultModel &&
		thinkingLevel === saved.defaultThinkingLevel
	) {
		return saved;
	}

	return { defaultProvider: provider, defaultModel: model, defaultThinkingLevel: thinkingLevel };
}

function hasCompleteModelPair(defaults: ModelDefaults): defaults is Required<Pick<ModelDefaults, "defaultProvider" | "defaultModel">> & ModelDefaults {
	return Boolean(defaults.defaultProvider && defaults.defaultModel);
}

function applyModelDefaults(settings: JsonObject | undefined, defaults: ModelDefaults): JsonObject | undefined {
	const nextSettings = settings ? { ...settings } : {};

	if (hasCompleteModelPair(defaults)) {
		nextSettings.defaultProvider = defaults.defaultProvider;
		nextSettings.defaultModel = defaults.defaultModel;
	} else {
		delete nextSettings.defaultProvider;
		delete nextSettings.defaultModel;
	}

	if (defaults.defaultThinkingLevel !== undefined) {
		nextSettings.defaultThinkingLevel = defaults.defaultThinkingLevel;
	} else {
		delete nextSettings.defaultThinkingLevel;
	}

	return Object.keys(nextSettings).length > 0 ? nextSettings : undefined;
}

async function readSettingsFile(settingsPath: string): Promise<JsonObject | undefined> {
	try {
		const content = await fs.readFile(settingsPath, "utf8");
		const parsed = JSON.parse(content) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error(`Settings file must contain a JSON object: ${settingsPath}`);
		}
		return parsed as JsonObject;
	} catch (error) {
		if (isMissingFileError(error)) {
			return undefined;
		}
		throw error;
	}
}

async function writeSettingsFile(settingsPath: string, settings: JsonObject | undefined): Promise<void> {
	if (!settings || Object.keys(settings).length === 0) {
		try {
			await fs.rm(settingsPath);
		} catch (error) {
			if (!isMissingFileError(error)) {
				throw error;
			}
		}
		return;
	}

	const nextContent = `${JSON.stringify(settings, null, SETTINGS_JSON_INDENT)}\n`;
	let currentContent: string | undefined;
	try {
		currentContent = await fs.readFile(settingsPath, "utf8");
	} catch (error) {
		if (!isMissingFileError(error)) {
			throw error;
		}
	}

	if (currentContent === nextContent) {
		return;
	}

	await fs.mkdir(path.dirname(settingsPath), { recursive: true });
	const tmpPath = `${settingsPath}.tmp`;
	try {
		await fs.writeFile(tmpPath, nextContent, "utf8");
		await fs.rename(tmpPath, settingsPath);
	} catch (error) {
		await fs.rm(tmpPath).catch(() => {});
		throw error;
	}
}

function isMissingFileError(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isThinkingLevel(value: unknown): value is ThinkingLevelSetting {
	return (
		value === "off" ||
		value === "minimal" ||
		value === "low" ||
		value === "medium" ||
		value === "high" ||
		value === "xhigh"
	);
}
