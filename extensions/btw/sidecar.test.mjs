import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
	BTW_IMPORT_TYPE,
	BTW_SIDECAR_STATE_TYPE,
	getBtwSidecarLocation,
	getImportOverlayHint,
	isImportOverlayCommand,
	isPartialImportOverlayCommand,
	resolveImportTarget,
	restorePersistedState,
} from "./sidecar.ts";

const require = createRequire(import.meta.url);

// Resolve pi-coding-agent: prefer local node_modules (devDependencies) so
// `npm test` works without a global pi install; fall back to the global pi
// prefix structure for environments where `npm install` has not been run.
const localAgentDir = fileURLToPath(new URL("../../node_modules/@mariozechner/pi-coding-agent", import.meta.url));
const piAgentDir = existsSync(localAgentDir)
	? localAgentDir
	: path.join(
			path.resolve(path.dirname(execFileSync("which", ["pi"], { encoding: "utf8" }).trim()), ".."),
			"lib",
			"node_modules",
			"@mariozechner",
			"pi-coding-agent",
		);

const { SessionManager } = require(path.join(piAgentDir, "dist", "index.js"));
const extensionPath = path.resolve("extensions/btw/index.ts");

function makeWorkspace() {
	const root = mkdtempSync(path.join(tmpdir(), "btw-sidecar-"));
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

function runBtw({ projectDir, sessionDir, agentDir }, sessionFile) {
	execFileSync(
		"pi",
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

test("helper logic keeps sidecars hidden and import resolution anchored", () => {
	const location = getBtwSidecarLocation("/tmp/sessions", "main-session-id");
	assert.equal(location.dir, "/tmp/sessions/.btw-sidecars/main-session-id");
	assert.equal(location.file, "/tmp/sessions/.btw-sidecars/main-session-id/default.jsonl");

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
	assert.equal(getImportOverlayHint(false), "Type /import to import main context.");
	assert.equal(getImportOverlayHint(true), "Type /import to refresh main context.");

	const restored = restorePersistedState(
		[
			{ type: "custom", customType: "btw-thread-entry", data: { question: "old", answer: "ignore" } },
			{ type: "custom", customType: "btw-thread-reset", data: { timestamp: 1 } },
			{ type: "custom", customType: BTW_IMPORT_TYPE, data: { messages: [{ role: "user" }], timestamp: 2, messageCount: 1 } },
			{ type: "custom", customType: "btw-thread-entry", data: { question: "new", answer: "keep" } },
			{ type: "custom", customType: BTW_SIDECAR_STATE_TYPE, data: { version: 1, mainSessionId: "abc" } },
		],
		{
			entryType: "btw-thread-entry",
			resetType: "btw-thread-reset",
			importType: BTW_IMPORT_TYPE,
			stateType: BTW_SIDECAR_STATE_TYPE,
		},
	);

	assert.deepEqual(restored.thread, [{ question: "new", answer: "keep" }]);
	assert.deepEqual(restored.importedContext, { messages: [{ role: "user" }], timestamp: 2, messageCount: 1 });
	assert.equal(restored.state?.mainSessionId, "abc");
});

test("/btw writes hidden sidecar metadata without touching the main session file", () => {
	const workspace = makeWorkspace();
	const mainSession = createMainSession(workspace);
	const before = readFileSync(mainSession.file, "utf8");

	runBtw(workspace, mainSession.file);

	const sidecar = getBtwSidecarLocation(workspace.sessionDir, mainSession.sessionId).file;
	assert.ok(existsSync(sidecar), "expected hidden sidecar file");
	const entries = readJsonl(sidecar);
	assert.equal(entries[0].parentSession, mainSession.file);
	assert.ok(entries.some((entry) => entry.customType === BTW_SIDECAR_STATE_TYPE));
	assert.ok(entries.some((entry) => entry.customType === "btw-thread-reset"));
	assert.ok(entries.some((entry) => entry.customType === BTW_SIDECAR_STATE_TYPE && entry.data.anchor));
	assert.equal(readFileSync(mainSession.file, "utf8"), before);
});

test("legacy inline BTW entries migrate into the sidecar on first restore", () => {
	const workspace = makeWorkspace();
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

	const sidecar = getBtwSidecarLocation(workspace.sessionDir, mainSession.sessionId).file;
	const entries = readJsonl(sidecar);
	assert.ok(entries.some((entry) => entry.customType === "btw-thread-entry"));
	assert.ok(entries.some((entry) => entry.customType === BTW_IMPORT_TYPE));
	assert.ok(entries.some((entry) => entry.customType === BTW_SIDECAR_STATE_TYPE && entry.data.migratedFromInlineAt));
	assert.equal(readFileSync(mainSession.file, "utf8"), before);
});

test("sidecars are reused per main session id and isolated between sessions", () => {
	const workspace = makeWorkspace();
	const sessionA = createMainSession(workspace);
	const sessionB = createMainSession(workspace);

	runBtw(workspace, sessionA.file);
	runBtw(workspace, sessionA.file);
	runBtw(workspace, sessionB.file);

	const sidecarA = getBtwSidecarLocation(workspace.sessionDir, sessionA.sessionId).file;
	const sidecarB = getBtwSidecarLocation(workspace.sessionDir, sessionB.sessionId).file;
	assert.ok(existsSync(sidecarA));
	assert.ok(existsSync(sidecarB));
	assert.notEqual(sidecarA, sidecarB);
});
