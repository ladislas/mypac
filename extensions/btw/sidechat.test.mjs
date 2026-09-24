import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
	BTW_IMPORT_TYPE,
	BTW_SIDECHAT_STATE_TYPE,
	getBtwSidechatLocation,
	getImportOverlayHint,
	isImportOverlayCommand,
	isPartialImportOverlayCommand,
	resolveImportTarget,
	restorePersistedState,
} from "./sidechat.ts";
import btwExtension from "./index.ts";
import {
	createSynchronizedModelRuntime,
	setSideSessionModel,
	synchronizeModelRuntime,
} from "./model-runtime.ts";
import {
	createCredentials,
	createModelServer,
	fakeOpenAiCodexCredential,
	HANG_RESPONSE,
} from "../../scripts/test-support/model-routing.mjs";

const require = createRequire(import.meta.url);

// Resolve pi-coding-agent: prefer local node_modules (devDependencies) so
// `npm test` works without a global pi install; fall back to the global pi
// prefix structure for environments where `npm install` has not been run.
const localAgentDir = fileURLToPath(new URL("../../node_modules/@earendil-works/pi-coding-agent", import.meta.url));
const piAgentDir = existsSync(localAgentDir)
	? localAgentDir
	: path.join(
			path.resolve(path.dirname(execFileSync("which", ["pi"], { encoding: "utf8" }).trim()), ".."),
			"lib",
			"node_modules",
			"@earendil-works",
			"pi-coding-agent",
		);

const {
	createAgentSession,
	ModelRegistry,
	ModelRuntime,
	SessionManager,
} = require(path.join(piAgentDir, "dist", "index.js"));
const extensionPath = path.resolve("extensions/btw/index.ts");
const localPiBin = fileURLToPath(new URL("../../node_modules/.bin/pi", import.meta.url));
const piCommand = existsSync(localPiBin) ? localPiBin : "pi";

async function createIsolatedChildRuntime(t, registry, provider) {
	const agentDir = mkdtempSync(path.join(tmpdir(), "btw-model-runtime-"));
	t.after(() => rmSync(agentDir, { recursive: true, force: true }));
	const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = agentDir;
	try {
		return await createSynchronizedModelRuntime(registry, provider);
	} finally {
		if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
	}
}

function makeWorkspace(t) {
	const root = mkdtempSync(path.join(tmpdir(), "btw-sidechat-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const projectDir = path.join(root, "project");
	const sessionDir = path.join(root, "sessions");
	const agentDir = path.join(root, "agent");
	mkdirSync(projectDir, { recursive: true });
	mkdirSync(sessionDir, { recursive: true });
	mkdirSync(agentDir, { recursive: true });
	return { root, projectDir, sessionDir, agentDir };
}

function rewriteSession(manager) {
	manager._rewriteFile();
}

function createMainSession({ projectDir, sessionDir }, legacyEntries = []) {
	const file = path.join(sessionDir, `main-${Math.random().toString(16).slice(2)}.jsonl`);
	const manager = SessionManager.open(file, sessionDir, projectDir);
	for (const entry of legacyEntries) {
		manager.appendCustomEntry(entry.customType, entry.data);
	}
	rewriteSession(manager);
	return {
		file,
		sessionId: manager.getSessionId(),
	};
}

function readJsonl(file) {
	return readFileSync(file, "utf8")
		.trim()
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line));
}

function assertNoBtwMainSessionEntries(file, beforeText) {
	const before = beforeText.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
	const after = readJsonl(file);
	assert.deepEqual(after.slice(0, before.length), before);
	assert.ok(after.slice(before.length).every((entry) => entry.type === "thinking_level_change"));
}

function runBtw({ projectDir, sessionDir, agentDir }, sessionFile) {
	execFileSync(
		piCommand,
		[
			"--offline",
			"--no-extensions",
			"-e",
			extensionPath,
			"--no-context-files",
			"--no-skills",
			"--no-prompt-templates",
			"--no-themes",
			"--session-dir",
			sessionDir,
			"--session",
			sessionFile,
			"-p",
			"/btw",
		],
		{
			cwd: projectDir,
			env: {
				...process.env,
				PI_CODING_AGENT_DIR: agentDir,
			},
			stdio: "pipe",
		},
	);
}

test("synchronizeModelRuntime mirrors registrations, removals, and runtime-only auth", async () => {
	const nativeProvider = { id: "native-provider" };
	const config = { baseUrl: "https://proxy.example" };
	const source = {
		getRegisteredProviderIds: () => ["native-provider", "configured-provider"],
		getRegisteredNativeProvider: (id) => id === "native-provider" ? nativeProvider : undefined,
		getRegisteredProviderConfig: (id) => id === "configured-provider" ? config : undefined,
		getProviderAuth: async (id) => id === "configured-provider"
			? { auth: { apiKey: "runtime-key" }, source: "runtime" }
			: undefined,
	};
	const events = [];
	const target = {
		getRegisteredProviderIds: () => ["stale-provider"],
		unregisterProvider: (id) => events.push(["unregister", id]),
		registerNativeProvider: (provider) => events.push(["native", provider]),
		registerProvider: (id, providerConfig) => events.push(["config", id, providerConfig]),
		refresh: async (options) => events.push(["refresh", options]),
		getAuth: async () => undefined,
		setRuntimeApiKey: async (id, key) => events.push(["auth", id, key]),
	};

	await synchronizeModelRuntime(source, target, "configured-provider");

	assert.deepEqual(events, [
		["unregister", "stale-provider"],
		["unregister", "native-provider"],
		["native", nativeProvider],
		["unregister", "configured-provider"],
		["config", "configured-provider", config],
		["refresh", { providers: ["stale-provider", "native-provider", "configured-provider"], allowNetwork: false }],
		["auth", "configured-provider", "runtime-key"],
	]);
});

test("synchronizeModelRuntime updates and removes mirrored runtime-only authentication", async () => {
	let sourceKey = "first-key";
	let targetKey;
	const events = [];
	const source = {
		getRegisteredProviderIds: () => [],
		getRegisteredNativeProvider: () => undefined,
		getRegisteredProviderConfig: () => undefined,
		getProviderAuth: async () => sourceKey ? { auth: { apiKey: sourceKey }, source: "runtime" } : undefined,
	};
	const target = {
		getRegisteredProviderIds: () => [],
		unregisterProvider() {},
		registerNativeProvider() {},
		registerProvider() {},
		refresh: async () => {},
		getAuth: async () => targetKey ? { auth: { apiKey: targetKey }, source: "runtime" } : undefined,
		setRuntimeApiKey: async (_id, key) => { targetKey = key; events.push(["set", key]); },
		removeRuntimeApiKey: async () => { targetKey = undefined; events.push(["remove"]); },
	};

	await synchronizeModelRuntime(source, target, "configured-provider");
	sourceKey = "second-key";
	await synchronizeModelRuntime(source, target, "configured-provider");
	sourceKey = undefined;
	await synchronizeModelRuntime(source, target, "configured-provider");

	assert.deepEqual(events, [["set", "first-key"], ["set", "second-key"], ["remove"]]);
});

test("synchronizeModelRuntime preserves child authentication resolved from shared storage", async () => {
	let mirrored = false;
	const source = {
		getRegisteredProviderIds: () => [],
		getRegisteredNativeProvider: () => undefined,
		getRegisteredProviderConfig: () => undefined,
		getProviderAuth: async () => ({ auth: { apiKey: "source-key" }, source: "runtime" }),
	};
	const target = {
		getRegisteredProviderIds: () => [],
		unregisterProvider() {},
		registerNativeProvider() {},
		registerProvider() {},
		refresh: async () => {},
		getAuth: async () => ({ auth: { apiKey: "stored-key" }, source: "stored" }),
		setRuntimeApiKey: async () => { mirrored = true; },
	};

	await synchronizeModelRuntime(source, target, "configured-provider");
	assert.equal(mirrored, false);
});

test("BTW preserves side-session thinking while synchronizing its model", async () => {
	const calls = [];
	const session = {
		thinkingLevel: "xhigh",
		async setModel(model) {
			calls.push(["model", model.id]);
			this.thinkingLevel = "medium";
		},
		setThinkingLevel(level) {
			calls.push(["thinking", level]);
			this.thinkingLevel = level;
		},
	};

	await setSideSessionModel(session, { id: "review-model" });

	assert.equal(session.thinkingLevel, "xhigh");
	assert.deepEqual(calls, [
		["model", "review-model"],
		["thinking", "xhigh"],
	]);
});

test("BTW sidechat sessions use built-in API-key auth and Headroom-style routing", async (t) => {
	const server = await createModelServer(t, ["sidechat response"]);
	const credentials = await createCredentials({
		openai: { type: "api_key", key: "sidechat-key" },
	});
	const sourceRuntime = await ModelRuntime.create({ credentials, allowModelNetwork: false });
	sourceRuntime.registerProvider("openai", {
		baseUrl: `${server.baseUrl}/v1`,
		headers: { "x-headroom-route": "sidechat" },
	});
	const model = sourceRuntime.getModel("openai", "gpt-5.4-mini");
	assert.ok(model);
	const childRuntime = await createIsolatedChildRuntime(t, new ModelRegistry(sourceRuntime), model.provider);
	const { session } = await createAgentSession({
		model,
		modelRuntime: childRuntime,
		sessionManager: SessionManager.inMemory(),
		noTools: "all",
	});
	t.after(() => session.dispose());

	await session.prompt("Use the active sidechat route", { source: "extension" });

	assert.equal(server.requests[0].url, "/v1/responses");
	assert.equal(server.requests[0].headers.authorization, "Bearer sidechat-key");
	assert.equal(server.requests[0].headers["x-headroom-route"], "sidechat");
	assert.equal(session.messages.at(-1).content[0].text, "sidechat response");
});

test("restored BTW import and thread reach the provider context", async (t) => {
	const workspace = makeWorkspace(t);
	const main = createMainSession(workspace);
	const location = getBtwSidechatLocation(workspace.sessionDir, main.sessionId);
	mkdirSync(location.dir, { recursive: true });
	const persisted = SessionManager.open(location.file, location.dir, workspace.projectDir);
	persisted.appendCustomEntry(BTW_IMPORT_TYPE, {
		messages: [{ role: "user", content: [{ type: "text", text: "Imported main context" }], timestamp: 1 }],
		timestamp: 1,
		messageCount: 1,
	});
	persisted.appendCustomEntry("btw-thread-entry", {
		question: "Earlier BTW question",
		answer: "Earlier BTW answer",
		timestamp: 2,
		provider: "extension-provider",
		model: "extension-model",
		thinkingLevel: "off",
	});
	rewriteSession(persisted);

	const server = await createModelServer(t, ["continued response"]);
	const runtime = await ModelRuntime.create({ allowModelNetwork: false });
	runtime.registerProvider("extension-provider", {
		baseUrl: `${server.baseUrl}/v1`,
		apiKey: "sidechat-key",
		api: "openai-responses",
		models: [{
			id: "extension-model", name: "Extension Model", reasoning: false, input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128_000, maxTokens: 4_096,
		}],
	});
	const model = runtime.getModel("extension-provider", "extension-model");
	assert.ok(model);
	let command;
	let onStart;
	let onShutdown;
	btwExtension({
		registerCommand: (name, definition) => { if (name === "btw") command = definition.handler; },
		on: (event, handler) => {
			if (event === "session_start") onStart = handler;
			if (event === "session_shutdown") onShutdown = handler;
		},
		getThinkingLevel: () => "off",
	});
	const ctx = {
		cwd: workspace.projectDir,
		mode: "rpc",
		hasUI: false,
		model,
		modelRegistry: new ModelRegistry(runtime),
		sessionManager: SessionManager.open(main.file, workspace.sessionDir, workspace.projectDir),
		getSystemPrompt: () => "",
	};
	await onStart({}, ctx);
	t.after(async () => { await onShutdown(); });
	await command("Continue BTW", ctx);

	const request = JSON.stringify(server.requests[0].body);
	assert.match(request, /Imported main context/);
	assert.match(request, /Earlier BTW question/);
	assert.match(request, /Earlier BTW answer/);
	assert.match(request, /Continue BTW/);
});

test("BTW summary sessions use built-in OAuth auth and active routing", async (t) => {
	const server = await createModelServer(t, ["summary response"]);
	const credential = fakeOpenAiCodexCredential("summary-account");
	const agentDir = mkdtempSync(path.join(tmpdir(), "btw-oauth-runtime-"));
	t.after(() => rmSync(agentDir, { recursive: true, force: true }));
	writeFileSync(path.join(agentDir, "auth.json"), JSON.stringify({ "openai-codex": credential }));
	const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = agentDir;
	let sourceRuntime;
	let childRuntime;
	let model;
	try {
		sourceRuntime = await ModelRuntime.create({ allowModelNetwork: false });
		sourceRuntime.registerProvider("openai-codex", {
			baseUrl: `${server.baseUrl}/backend-api`,
			headers: { "x-active-runtime": "summary" },
		});
		model = sourceRuntime.getModel("openai-codex", "gpt-5.6-luna");
		assert.ok(model);
		childRuntime = await createSynchronizedModelRuntime(new ModelRegistry(sourceRuntime), model.provider);
	} finally {
		if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
	}
	const { session } = await createAgentSession({
		model,
		modelRuntime: childRuntime,
		sessionManager: SessionManager.inMemory(),
		noTools: "all",
	});
	t.after(() => session.dispose());

	const originalWebSocket = globalThis.WebSocket;
	globalThis.WebSocket = undefined;
	try {
		await session.prompt("Summarize this sidechat", { source: "extension" });
	} finally {
		globalThis.WebSocket = originalWebSocket;
	}

	assert.equal(server.requests[0].url, "/backend-api/codex/responses");
	assert.equal(server.requests[0].headers.authorization, `Bearer ${credential.access}`);
	assert.equal(server.requests[0].headers["chatgpt-account-id"], "summary-account");
	assert.equal(server.requests[0].headers["x-active-runtime"], "summary");
	assert.equal(session.messages.at(-1).content[0].text, "summary response");
});

test("BTW child runtimes mirror custom-provider registration and teardown", async (t) => {
	const server = await createModelServer(t, ["custom response"]);
	const sourceRuntime = await ModelRuntime.create({ allowModelNetwork: false });
	sourceRuntime.registerProvider("extension-provider", {
		name: "Extension Provider",
		baseUrl: `${server.baseUrl}/v1`,
		apiKey: "extension-key",
		api: "openai-responses",
		models: [{
			id: "extension-model",
			name: "Extension Model",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128_000,
			maxTokens: 4_096,
		}],
	});
	const registry = new ModelRegistry(sourceRuntime);
	const childRuntime = await createIsolatedChildRuntime(t, registry, "extension-provider");
	const model = childRuntime.getModel("extension-provider", "extension-model");
	assert.ok(model);
	const { session } = await createAgentSession({
		model,
		modelRuntime: childRuntime,
		sessionManager: SessionManager.inMemory(),
		noTools: "all",
	});
	t.after(() => session.dispose());

	await session.prompt("Use the extension provider", { source: "extension" });
	assert.equal(server.requests[0].headers.authorization, "Bearer extension-key");

	sourceRuntime.unregisterProvider("extension-provider");
	await synchronizeModelRuntime(registry, childRuntime, "extension-provider");
	assert.equal(childRuntime.getProvider("extension-provider"), undefined);
	assert.equal(childRuntime.getModel("extension-provider", "extension-model"), undefined);

	const replacementRuntime = await createIsolatedChildRuntime(t, registry, "extension-provider");
	assert.equal(replacementRuntime.getProvider("extension-provider"), undefined);
});

test("BTW child-session cancellation aborts the active provider request", async (t) => {
	const server = await createModelServer(t, [HANG_RESPONSE]);
	const credentials = await createCredentials({
		openai: { type: "api_key", key: "cancel-key" },
	});
	const sourceRuntime = await ModelRuntime.create({ credentials, allowModelNetwork: false });
	sourceRuntime.registerProvider("openai", { baseUrl: `${server.baseUrl}/v1` });
	const model = sourceRuntime.getModel("openai", "gpt-5.4-mini");
	assert.ok(model);
	const childRuntime = await createIsolatedChildRuntime(t, new ModelRegistry(sourceRuntime), model.provider);
	const { session } = await createAgentSession({
		model,
		modelRuntime: childRuntime,
		sessionManager: SessionManager.inMemory(),
		noTools: "all",
	});
	t.after(() => session.dispose());

	const prompt = session.prompt("Wait for cancellation", { source: "extension" });
	await server.requestReceived;
	await session.abort();
	await prompt;

	assert.equal(server.requests.length, 1);
	assert.equal(session.messages.at(-1).stopReason, "aborted");
});

test("helper logic keeps sidechats hidden and import resolution anchored", () => {
	const location = getBtwSidechatLocation("/tmp/sessions", "main-session-id");
	assert.equal(location.dir, "/tmp/sessions/.btw-sidechats/main-session-id");
	assert.equal(location.file, "/tmp/sessions/.btw-sidechats/main-session-id/default.jsonl");

	assert.deepEqual(resolveImportTarget({ leafId: "launch-leaf", timestamp: 1 }, "current-leaf", false), {
		source: "launch",
		leafId: "launch-leaf",
	});
	assert.deepEqual(resolveImportTarget({ leafId: "launch-leaf", timestamp: 1 }, "current-leaf", true), {
		source: "refresh",
		leafId: "current-leaf",
	});
	assert.equal(isImportOverlayCommand("/import"), true);
	assert.equal(isImportOverlayCommand("  /import  "), true);
	assert.equal(isImportOverlayCommand("/import please"), false);
	assert.equal(isPartialImportOverlayCommand("/import please"), true);
	assert.equal(isPartialImportOverlayCommand("/import "), false);
	assert.equal(isPartialImportOverlayCommand("/import"), false);
	assert.equal(isPartialImportOverlayCommand("hello /import"), false);
	assert.equal(getImportOverlayHint(false), "/import main context");
	assert.equal(getImportOverlayHint(true), "/import main context");

	const restored = restorePersistedState(
		[
			{ type: "custom", customType: "btw-thread-entry", data: { question: "old", answer: "ignore" } },
			{ type: "custom", customType: "btw-thread-reset", data: { timestamp: 1 } },
			{ type: "custom", customType: BTW_IMPORT_TYPE, data: { messages: [{ role: "user" }], timestamp: 2, messageCount: 1 } },
			{ type: "custom", customType: "btw-thread-entry", data: { question: "new", answer: "keep" } },
			{ type: "custom", customType: BTW_SIDECHAT_STATE_TYPE, data: { version: 1, mainSessionId: "abc" } },
		],
		{
			entryType: "btw-thread-entry",
			resetType: "btw-thread-reset",
			importType: BTW_IMPORT_TYPE,
			stateType: BTW_SIDECHAT_STATE_TYPE,
		},
	);

	assert.deepEqual(restored.thread, [{ question: "new", answer: "keep" }]);
	assert.deepEqual(restored.importedContext, { messages: [{ role: "user" }], timestamp: 2, messageCount: 1 });
	assert.equal(restored.state?.mainSessionId, "abc");
});

test("/btw writes metadata only to the hidden sidechat", (t) => {
	const workspace = makeWorkspace(t);
	const mainSession = createMainSession(workspace);
	const before = readFileSync(mainSession.file, "utf8");

	runBtw(workspace, mainSession.file);

	const sidechat = getBtwSidechatLocation(workspace.sessionDir, mainSession.sessionId).file;
	assert.ok(existsSync(sidechat), "expected hidden sidechat file");
	const entries = readJsonl(sidechat);
	assert.equal(entries[0].parentSession, mainSession.file);
	assert.ok(entries.some((entry) => entry.customType === BTW_SIDECHAT_STATE_TYPE));
	assert.ok(entries.some((entry) => entry.customType === "btw-thread-reset"));
	assert.ok(entries.some((entry) => entry.customType === BTW_SIDECHAT_STATE_TYPE && entry.data.anchor));
	assertNoBtwMainSessionEntries(mainSession.file, before);
});

test("legacy inline BTW entries are ignored on first restore", (t) => {
	const workspace = makeWorkspace(t);
	const legacyImport = {
		messages: [{ role: "user", content: [{ type: "text", text: "snapshot" }], timestamp: 1 }],
		timestamp: 1,
		messageCount: 1,
	};
	const mainSession = createMainSession(workspace, [
		{ customType: "btw-thread-entry", data: { question: "legacy question", answer: "legacy answer" } },
		{ customType: BTW_IMPORT_TYPE, data: legacyImport },
	]);
	const before = readFileSync(mainSession.file, "utf8");

	runBtw(workspace, mainSession.file);

	const sidechat = getBtwSidechatLocation(workspace.sessionDir, mainSession.sessionId).file;
	const entries = readJsonl(sidechat);
	assert.ok(!entries.some((entry) => entry.customType === "btw-thread-entry"));
	assert.ok(!entries.some((entry) => entry.customType === BTW_IMPORT_TYPE));
	assertNoBtwMainSessionEntries(mainSession.file, before);
});

test("sidechats are reused per main session id and isolated between sessions", (t) => {
	const workspace = makeWorkspace(t);
	const sessionA = createMainSession(workspace);
	const sessionB = createMainSession(workspace);

	runBtw(workspace, sessionA.file);
	runBtw(workspace, sessionA.file);
	runBtw(workspace, sessionB.file);

	const sidechatA = getBtwSidechatLocation(workspace.sessionDir, sessionA.sessionId).file;
	const sidechatB = getBtwSidechatLocation(workspace.sessionDir, sessionB.sessionId).file;
	assert.ok(existsSync(sidechatA));
	assert.ok(existsSync(sidechatB));
	assert.notEqual(sidechatA, sidechatB);
});
