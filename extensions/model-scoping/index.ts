import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
	currentSessionDefaults,
	didSessionStateChange,
	getLatestSessionStateEntryIds,
	readScopedModelDefaults,
	resolveEffectiveModelDefaults,
	restoreScopedModelDefaults,
	writeScopedModelDefaults,
	type ModelDefaults,
	type ScopedModelDefaults,
	type SessionStateEntryIds,
	type ThinkingLevelSetting,
} from "./settings.ts";

type TrackerState = {
	agentDir: string;
	cwd: string;
	savedDefaults: ScopedModelDefaults;
	lastEntryIds: SessionStateEntryIds;
	sessionManager: ExtensionContext["sessionManager"];
	pollHandle?: NodeJS.Timeout;
	syncInFlight: boolean;
	lastError?: string;
};

const POLL_INTERVAL_MS = 250;

export default function modelScopingExtension(pi: ExtensionAPI) {
	let tracker: TrackerState | undefined;

	function clearTracker(): void {
		if (tracker?.pollHandle) {
			clearInterval(tracker.pollHandle);
		}
		tracker = undefined;
	}

	function updateSavedDefaults(scope: "repo" | "global", defaults: ModelDefaults): void {
		if (!tracker) {
			return;
		}

		const repo = scope === "repo" ? defaults : tracker.savedDefaults.repo;
		const global = scope === "global" ? defaults : tracker.savedDefaults.global;
		tracker.savedDefaults = {
			repo,
			global,
			effective: resolveEffectiveModelDefaults({ repo, global }),
		};
	}

	function clearLastError(state: TrackerState): void {
		state.lastError = undefined;
	}

	function reportError(state: TrackerState, ctx: ExtensionContext | undefined, error: unknown, prefix: string): void {
		const message = `${prefix}: ${error instanceof Error ? error.message : String(error)}`;
		if (state.lastError === message) {
			return;
		}
		state.lastError = message;
		console.error(`[model-scoping] ${message}`);
		ctx?.ui.notify(message, "warning");
	}

	async function syncSavedDefaults(state: TrackerState, ctx?: ExtensionContext): Promise<void> {
		const nextEntryIds = getLatestSessionStateEntryIds(state.sessionManager.getBranch());
		if (!didSessionStateChange(state.lastEntryIds, nextEntryIds)) {
			return;
		}

		state.lastEntryIds = nextEntryIds;
		await restoreScopedModelDefaults(state.cwd, state.savedDefaults, state.agentDir);
		clearLastError(state);
	}

	async function runSync(ctx?: ExtensionContext): Promise<void> {
		const state = tracker;
		if (!state || state.syncInFlight) {
			return;
		}

		state.syncInFlight = true;
		try {
			await syncSavedDefaults(state, ctx);
		} catch (error) {
			reportError(state, ctx, error, "Failed to restore saved model defaults");
		} finally {
			state.syncInFlight = false;
		}
	}

	async function persistCurrentState(scope: "repo" | "global", ctx: ExtensionContext): Promise<void> {
		if (!ctx.model) {
			ctx.ui.notify("No active model to save", "error");
			return;
		}

		const defaults = currentSessionDefaults(ctx.model, pi.getThinkingLevel() as ThinkingLevelSetting);
		try {
			await writeScopedModelDefaults(ctx.cwd, scope, defaults, tracker?.agentDir ?? getAgentDir());
			updateSavedDefaults(scope, defaults);
			const scopeLabel = scope === "repo" ? "repo" : "global";
			ctx.ui.notify(
				`Saved ${formatDefaults(defaults)} as ${scopeLabel} defaults`,
				"info",
			);
		} catch (error) {
			ctx.ui.notify(
				`Failed to save ${scope} defaults: ${error instanceof Error ? error.message : String(error)}`,
				"error",
			);
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		clearTracker();
		const agentDir = getAgentDir();
		try {
			tracker = {
				agentDir,
				cwd: ctx.cwd,
				savedDefaults: await readScopedModelDefaults(ctx.cwd, agentDir),
				lastEntryIds: getLatestSessionStateEntryIds(ctx.sessionManager.getBranch()),
				sessionManager: ctx.sessionManager,
				syncInFlight: false,
			};
		} catch (error) {
			console.error("[model-scoping] Failed to initialize:", error);
			ctx.ui.notify(
				`Model scoping is disabled for this session: ${error instanceof Error ? error.message : String(error)}`,
				"warning",
			);
			return;
		}

		tracker.pollHandle = setInterval(() => {
			void runSync();
		}, POLL_INTERVAL_MS);
		tracker.pollHandle.unref?.();
	});

	pi.on("model_select", async (_event, ctx) => {
		await runSync(ctx);
	});

	pi.on("session_tree", async (_event, ctx) => {
		await runSync(ctx);
	});

	pi.on("session_shutdown", async () => {
		clearTracker();
	});

	pi.registerCommand("save-model-repo", {
		description: "Persist the current active model and thinking level as repo defaults",
		handler: async (_args, ctx) => {
			await persistCurrentState("repo", ctx);
		},
	});

	pi.registerCommand("save-model-global", {
		description: "Persist the current active model and thinking level as global defaults",
		handler: async (_args, ctx) => {
			await persistCurrentState("global", ctx);
		},
	});
}

function formatDefaults(defaults: ModelDefaults): string {
	const model = defaults.defaultProvider && defaults.defaultModel
		? `${defaults.defaultProvider}/${defaults.defaultModel}`
		: "(no model)";
	const thinking = defaults.defaultThinkingLevel ?? "unset";
	return `${model} (${thinking})`;
}
