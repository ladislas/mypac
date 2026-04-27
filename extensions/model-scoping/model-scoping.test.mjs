import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	AuthStorage,
	createAgentSession,
	ModelRegistry,
	SessionManager,
	SettingsManager,
} from "@mariozechner/pi-coding-agent";
import {
	getActiveModelFromBranch,
	getLatestSessionStateEntryIds,
	readScopedModelDefaults,
	refreshSavedDefaultsFromDisk,
	resolveEffectiveModelDefaults,
	restoreScopedModelDefaults,
	writeScopedModelDefaults,
} from "./settings.ts";

function makeWorkspace() {
	const root = mkdtempSync(path.join(tmpdir(), "model-scoping-"));
	const projectDir = path.join(root, "project");
	const agentDir = path.join(root, "agent");
	const sessionDir = path.join(root, "sessions");
	mkdirSync(projectDir, { recursive: true });
	mkdirSync(agentDir, { recursive: true });
	mkdirSync(sessionDir, { recursive: true });
	return { root, projectDir, agentDir, sessionDir };
}

function readJson(filePath) {
	return JSON.parse(readFileSync(filePath, "utf8"));
}

function rewriteSession(sessionManager) {
	sessionManager._rewriteFile();
}

function registerTestModels(modelRegistry) {
	modelRegistry.registerProvider("test", {
		api: "openai-completions",
		apiKey: "test-api-key",
		baseUrl: "https://example.com/v1",
		models: [
			{
				id: "reasoner",
				name: "Reasoner",
				reasoning: true,
				input: ["text"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 128000,
				maxTokens: 8192,
			},
			{
				id: "cheap",
				name: "Cheap",
				reasoning: false,
				input: ["text"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 128000,
				maxTokens: 8192,
			},
			{
				id: "backup",
				name: "Backup",
				reasoning: true,
				input: ["text"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 128000,
				maxTokens: 8192,
			},
		],
	});

	return {
		reasoner: modelRegistry.find("test", "reasoner"),
		cheap: modelRegistry.find("test", "cheap"),
		backup: modelRegistry.find("test", "backup"),
	};
}

test("writeScopedModelDefaults preserves unrelated settings while updating managed defaults", async () => {
	const workspace = makeWorkspace();
	const repoSettingsPath = path.join(workspace.projectDir, ".pi", "settings.json");
	mkdirSync(path.dirname(repoSettingsPath), { recursive: true });
	writeFileSync(
		repoSettingsPath,
		JSON.stringify(
			{
				theme: "nightowl",
				compaction: { enabled: true, reserveTokens: 8192 },
				defaultProvider: "openai",
				defaultModel: "gpt-4o-mini",
				defaultThinkingLevel: "low",
			},
			null,
			2,
		),
	);

	await writeScopedModelDefaults(
		workspace.projectDir,
		"repo",
		{
			defaultProvider: "anthropic",
			defaultModel: "claude-sonnet-4-5",
			defaultThinkingLevel: "high",
		},
		workspace.agentDir,
	);

	assert.deepEqual(readJson(repoSettingsPath), {
		theme: "nightowl",
		compaction: { enabled: true, reserveTokens: 8192 },
		defaultProvider: "anthropic",
		defaultModel: "claude-sonnet-4-5",
		defaultThinkingLevel: "high",
	});

	await writeScopedModelDefaults(workspace.projectDir, "repo", {}, workspace.agentDir);

	assert.deepEqual(readJson(repoSettingsPath), {
		theme: "nightowl",
		compaction: { enabled: true, reserveTokens: 8192 },
	});
});

test("resolveEffectiveModelDefaults ignores partial repo model overrides while keeping repo thinking overrides", () => {
	assert.deepEqual(
		resolveEffectiveModelDefaults({
			repo: { defaultProvider: "anthropic", defaultThinkingLevel: "high" },
			global: { defaultProvider: "openai", defaultModel: "gpt-4o", defaultThinkingLevel: "low" },
		}),
		{
			defaultProvider: "openai",
			defaultModel: "gpt-4o",
			defaultThinkingLevel: "high",
		},
	);

	assert.deepEqual(
		resolveEffectiveModelDefaults({
			repo: { defaultModel: "claude-sonnet-4-5" },
			global: { defaultProvider: "anthropic", defaultModel: "claude-opus-4-1" },
		}),
		{
			defaultProvider: "anthropic",
			defaultModel: "claude-opus-4-1",
			defaultThinkingLevel: undefined,
		},
	);
});

test("restoreScopedModelDefaults restores saved defaults without clobbering unrelated settings", async () => {
	const workspace = makeWorkspace();
	const globalSettingsPath = path.join(workspace.agentDir, "settings.json");
	const repoSettingsPath = path.join(workspace.projectDir, ".pi", "settings.json");
	mkdirSync(path.dirname(repoSettingsPath), { recursive: true });
	writeFileSync(
		globalSettingsPath,
		JSON.stringify(
			{
				theme: "nightowl",
				defaultProvider: "openai",
				defaultModel: "gpt-4o",
				defaultThinkingLevel: "medium",
			},
			null,
			2,
		),
	);
	writeFileSync(
		repoSettingsPath,
		JSON.stringify(
			{
				defaultThinkingLevel: "high",
				packages: ["pi-skills"],
			},
			null,
			2,
		),
	);

	const savedDefaults = await readScopedModelDefaults(workspace.projectDir, workspace.agentDir);

	writeFileSync(
		globalSettingsPath,
		JSON.stringify(
			{
				theme: "light",
				defaultProvider: "anthropic",
				defaultModel: "claude-sonnet-4-5",
				defaultThinkingLevel: "low",
			},
			null,
			2,
		),
	);
	writeFileSync(
		repoSettingsPath,
		JSON.stringify(
			{
				defaultProvider: "anthropic",
				defaultModel: "claude-opus-4-1",
				defaultThinkingLevel: "off",
				packages: ["pi-skills"],
			},
			null,
			2,
		),
	);

	await restoreScopedModelDefaults(workspace.projectDir, savedDefaults, workspace.agentDir);

	assert.deepEqual(readJson(globalSettingsPath), {
		theme: "light",
		defaultProvider: "openai",
		defaultModel: "gpt-4o",
		defaultThinkingLevel: "medium",
	});
	assert.deepEqual(readJson(repoSettingsPath), {
		defaultThinkingLevel: "high",
		packages: ["pi-skills"],
	});
});

test("restoreScopedModelDefaults removes settings files when only managed defaults were present originally", async () => {
	const workspace = makeWorkspace();
	const globalSettingsPath = path.join(workspace.agentDir, "settings.json");
	writeFileSync(
		globalSettingsPath,
		JSON.stringify(
			{
				defaultProvider: "openai",
				defaultModel: "gpt-4o",
				defaultThinkingLevel: "medium",
			},
			null,
			2,
		),
	);

	const savedDefaults = {
		repo: {},
		global: {},
		effective: {},
	};

	await restoreScopedModelDefaults(workspace.projectDir, savedDefaults, workspace.agentDir);

	assert.equal(existsSync(globalSettingsPath), false);
});

test("getLatestSessionStateEntryIds tracks the latest branch-local model and thinking entries", () => {
	const entries = [
		{ type: "message", id: "m1" },
		{ type: "model_change", id: "model-1" },
		{ type: "thinking_level_change", id: "thinking-1" },
		{ type: "message", id: "m2" },
		{ type: "thinking_level_change", id: "thinking-2" },
		{ type: "model_change", id: "model-2" },
	];

	assert.deepEqual(getLatestSessionStateEntryIds(entries), {
		modelEntryId: "model-2",
		thinkingEntryId: "thinking-2",
	});
});

test("createAgentSession pins the initial model and thinking level into new session history", async () => {
	const workspace = makeWorkspace();
	const authStorage = AuthStorage.inMemory();
	const modelRegistry = ModelRegistry.inMemory(authStorage);
	const { reasoner } = registerTestModels(modelRegistry);
	assert.ok(reasoner, "expected test model");

	const sessionManager = SessionManager.create(workspace.projectDir, workspace.sessionDir);
	const settingsManager = SettingsManager.inMemory();
	const { session } = await createAgentSession({
		cwd: workspace.projectDir,
		agentDir: workspace.agentDir,
		authStorage,
		modelRegistry,
		settingsManager,
		sessionManager,
		model: reasoner,
		thinkingLevel: "high",
		noTools: "all",
	});

	assert.deepEqual(
		sessionManager.getBranch().map((entry) => entry.type),
		["model_change", "thinking_level_change"],
	);
	assert.equal(sessionManager.getBranch()[0].provider, "test");
	assert.equal(sessionManager.getBranch()[0].modelId, "reasoner");
	assert.equal(sessionManager.getBranch()[1].thinkingLevel, "high");

	session.dispose();
});

test("session history restores branch-local model and thinking for resume, undo, and tree navigation", () => {
	const workspace = makeWorkspace();
	const sessionManager = SessionManager.create(workspace.projectDir, workspace.sessionDir);

	const initialModelId = sessionManager.appendModelChange("test", "reasoner");
	const initialThinkingId = sessionManager.appendThinkingLevelChange("medium");
	const checkpointId = sessionManager.appendMessage({
		role: "user",
		content: [{ type: "text", text: "checkpoint" }],
		timestamp: Date.now(),
	});
	const laterModelId = sessionManager.appendModelChange("test", "cheap");
	const laterThinkingId = sessionManager.appendThinkingLevelChange("off");

	let context = sessionManager.buildSessionContext();
	assert.deepEqual(context.model, { provider: "test", modelId: "cheap" });
	assert.equal(context.thinkingLevel, "off");

	// Trigger pi's natural persistence: a session is only written to disk after the first
	// assistant message. Appending one here flushes all prior entries to disk so we can
	// open the session file with SessionManager.open().
	sessionManager.appendMessage({
		role: "assistant",
		content: [{ type: "text", text: "ok" }],
		provider: "test",
		model: "cheap",
		usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
		stopReason: "stop",
		timestamp: Date.now(),
	});
	const resumed = SessionManager.open(sessionManager.getSessionFile(), workspace.sessionDir, workspace.projectDir);
	context = resumed.buildSessionContext();
	assert.deepEqual(context.model, { provider: "test", modelId: "cheap" });
	assert.equal(context.thinkingLevel, "off");

	resumed.branch(checkpointId);
	context = resumed.buildSessionContext();
	assert.deepEqual(context.model, { provider: "test", modelId: "reasoner" });
	assert.equal(context.thinkingLevel, "medium");

	resumed.appendModelChange("test", "backup");
	resumed.appendThinkingLevelChange("high");
	context = resumed.buildSessionContext();
	assert.deepEqual(context.model, { provider: "test", modelId: "backup" });
	assert.equal(context.thinkingLevel, "high");

	resumed.branch(laterThinkingId);
	context = resumed.buildSessionContext();
	assert.deepEqual(context.model, { provider: "test", modelId: "cheap" });
	assert.equal(context.thinkingLevel, "off");

	assert.ok(initialModelId);
	assert.ok(initialThinkingId);
	assert.ok(laterModelId);
});

test("createAgentSession falls back from an unavailable saved model without mutating history or defaults", async () => {
	const workspace = makeWorkspace();
	const globalSettingsPath = path.join(workspace.agentDir, "settings.json");
	writeFileSync(
		globalSettingsPath,
		JSON.stringify(
			{
				defaultProvider: "test",
				defaultModel: "reasoner",
				defaultThinkingLevel: "low",
			},
			null,
			2,
		),
	);

	const authStorage = AuthStorage.inMemory();
	const modelRegistry = ModelRegistry.inMemory(authStorage);
	registerTestModels(modelRegistry);

	const sessionManager = SessionManager.create(workspace.projectDir, workspace.sessionDir);
	sessionManager.appendModelChange("test", "missing-model");
	sessionManager.appendThinkingLevelChange("high");
	sessionManager.appendMessage({
		role: "user",
		content: [{ type: "text", text: "resume me" }],
		timestamp: Date.now(),
	});
	const entryTypesBefore = sessionManager.getEntries().map((entry) => entry.type);

	const settingsManager = SettingsManager.create(workspace.projectDir, workspace.agentDir);
	const { session, modelFallbackMessage } = await createAgentSession({
		cwd: workspace.projectDir,
		agentDir: workspace.agentDir,
		authStorage,
		modelRegistry,
		settingsManager,
		sessionManager,
		noTools: "all",
	});

	assert.equal(session.model?.provider, "test");
	assert.equal(session.model?.id, "reasoner");
	assert.equal(session.thinkingLevel, "high");
	assert.match(modelFallbackMessage ?? "", /Could not restore model test\/missing-model/);
	assert.deepEqual(sessionManager.getEntries().map((entry) => entry.type), entryTypesBefore);
	assert.equal(
		[...sessionManager.getBranch()].reverse().find((entry) => entry.type === "model_change")?.modelId,
		"missing-model",
	);
	assert.equal(
		[...sessionManager.getBranch()].reverse().find((entry) => entry.type === "thinking_level_change")?.thinkingLevel,
		"high",
	);
	assert.deepEqual(readJson(globalSettingsPath), {
		defaultProvider: "test",
		defaultModel: "reasoner",
		defaultThinkingLevel: "low",
	});

	session.dispose();
});

test("getActiveModelFromBranch returns latest model_change provider and modelId", () => {
	const entries = [
		{ type: "model_change", id: "m1", provider: "test", modelId: "reasoner" },
		{ type: "thinking_level_change", id: "t1", thinkingLevel: "high" },
		{ type: "model_change", id: "m2", provider: "test", modelId: "cheap" },
	];
	assert.deepEqual(getActiveModelFromBranch(entries), { provider: "test", modelId: "cheap" });
});

test("getActiveModelFromBranch returns null when no model_change entry exists", () => {
	assert.equal(getActiveModelFromBranch([]), null);
	assert.equal(getActiveModelFromBranch([{ type: "thinking_level_change", id: "t1", thinkingLevel: "off" }]), null);
});

test("refreshSavedDefaultsFromDisk returns saved unchanged when disk matches saved", () => {
	const saved = {
		repo: {},
		global: { defaultProvider: "openai", defaultModel: "gpt-4o", defaultThinkingLevel: "medium" },
		effective: { defaultProvider: "openai", defaultModel: "gpt-4o", defaultThinkingLevel: "medium" },
	};
	const result = refreshSavedDefaultsFromDisk(saved, saved, { provider: "openai", modelId: "gpt-4o" });
	assert.equal(result, saved);
});

test("refreshSavedDefaultsFromDisk keeps saved snapshot when disk shows active session model (pi wrote it)", () => {
	const saved = {
		repo: {},
		global: { defaultProvider: "anthropic", defaultModel: "claude", defaultThinkingLevel: "low" },
		effective: { defaultProvider: "anthropic", defaultModel: "claude", defaultThinkingLevel: "low" },
	};
	const disk = {
		repo: {},
		global: { defaultProvider: "openai", defaultModel: "gpt-4o", defaultThinkingLevel: "low" },
		effective: { defaultProvider: "openai", defaultModel: "gpt-4o", defaultThinkingLevel: "low" },
	};
	// disk now shows the active session model → pi wrote it → keep saved snapshot
	const result = refreshSavedDefaultsFromDisk(saved, disk, { provider: "openai", modelId: "gpt-4o" });
	assert.deepEqual(result.global, saved.global);
	assert.deepEqual(result.repo, saved.repo);
});

test("refreshSavedDefaultsFromDisk adopts disk when another session explicitly saved new defaults", () => {
	const saved = {
		repo: {},
		global: { defaultProvider: "anthropic", defaultModel: "claude", defaultThinkingLevel: "low" },
		effective: { defaultProvider: "anthropic", defaultModel: "claude", defaultThinkingLevel: "low" },
	};
	const disk = {
		repo: {},
		global: { defaultProvider: "openai", defaultModel: "gpt-5.4", defaultThinkingLevel: "high" },
		effective: { defaultProvider: "openai", defaultModel: "gpt-5.4", defaultThinkingLevel: "high" },
	};
	// Active session model is "claude", disk shows "gpt-5.4" → external explicit save
	const result = refreshSavedDefaultsFromDisk(saved, disk, { provider: "anthropic", modelId: "claude" });
	assert.deepEqual(result.global, disk.global);
	assert.deepEqual(result.repo, disk.repo);
});

test("refreshSavedDefaultsFromDisk always adopts thinking level from disk (pi never writes it)", () => {
	const saved = {
		repo: {},
		global: { defaultProvider: "openai", defaultModel: "gpt-4o", defaultThinkingLevel: "low" },
		effective: { defaultProvider: "openai", defaultModel: "gpt-4o", defaultThinkingLevel: "low" },
	};
	const disk = {
		repo: {},
		// model pair same as active session model (pi wrote it), but thinking changed (external)
		global: { defaultProvider: "openai", defaultModel: "gpt-4o", defaultThinkingLevel: "high" },
		effective: { defaultProvider: "openai", defaultModel: "gpt-4o", defaultThinkingLevel: "high" },
	};
	const result = refreshSavedDefaultsFromDisk(saved, disk, { provider: "openai", modelId: "gpt-4o" });
	// model pair: disk has session model → keep saved snapshot model pair
	assert.equal(result.global.defaultProvider, "openai");
	assert.equal(result.global.defaultModel, "gpt-4o");
	// thinking level: always adopt from disk
	assert.equal(result.global.defaultThinkingLevel, "high");
});
