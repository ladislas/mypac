import test from "node:test";
import assert from "node:assert/strict";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { registerHooks } from "node:module";
import ts from "typescript";
import { SKILL_LOADED_ENTRY } from "./data.ts";

// Match Pi's TypeScript loader for the view's parameter properties, which
// Node's strip-only test runner cannot parse. No production modules are mocked.
const loader = registerHooks({
	load(url, context, nextLoad) {
		const result = nextLoad(url, context);
		if (!url.endsWith("/context/view.ts")) return result;
		return { ...result, format: "module", source: ts.transpileModule(String(result.source), {
			compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
		}).outputText };
	},
});
const { default: contextExtension } = await import("./index.ts");
loader.deregister();

function setup() {
	const handlers = new Map();
	const commands = new Map();
	let session = SessionManager.inMemory(process.cwd());
	let prompt = "initial prompt";
	let output;
	let branchReads = 0;
	let entryReads = 0;
	let indexReads = 0;
	const ctx = {
		cwd: process.cwd(),
		mode: "json",
		get sessionManager() {
			return {
				getSessionId: () => session.getSessionId(),
				getBranch: () => { branchReads++; return session.getBranch(); },
				getEntries: () => { entryReads++; return session.getEntries(); },
			};
		},
		getSystemPrompt: () => prompt,
		getSystemPromptOptions: () => ({ cwd: process.cwd(), contextFiles: [] }),
		getContextUsage: () => null,
	};
	contextExtension({
		on: (name, handler) => handlers.set(name, handler),
		registerCommand: (name, command) => commands.set(name, command),
		getCommands: () => {
			indexReads++;
			return ["alpha", "beta"].map((name) => ({
				name, source: "skill", sourceInfo: { path: `/skills/${name}/SKILL.md` },
			}));
		},
		getActiveTools: () => [],
		getAllTools: () => [],
		appendEntry: (type, data) => session.appendCustomEntry(type, data),
		sendMessage: (message) => { output = message.content; },
	});
	const emit = (name, event = {}) => handlers.get(name)?.({ type: name, ...event }, ctx);
	return {
		emit,
		get session() { return session; },
		set session(value) { session = value; },
		set prompt(value) { prompt = value; },
		get reads() { return { branchReads, entryReads, indexReads }; },
		read: (name) => emit("tool_result", { toolName: "read", input: { path: `/skills/${name}/SKILL.md` }, isError: false }),
		async show() { await commands.get("context").handler("", ctx); return output; },
		async navigate(target) {
			const oldLeafId = session.getLeafId();
			session.branch(target);
			await emit("session_tree", { oldLeafId, newLeafId: session.getLeafId() });
		},
	};
}

function markers(session) {
	return session.getBranch().filter((entry) => entry.type === "custom" && entry.customType === SKILL_LOADED_ENTRY);
}

test("load → rewind → reload records the skill again through lifecycle handlers", async () => {
	const h = setup();
	const root = h.session.appendCustomEntry("test-root", {});
	await h.emit("session_start", { reason: "startup" });
	await h.read("alpha");
	assert.match(await h.show(), /alpha \(~/);
	await h.navigate(root);
	assert.match(await h.show(), /alpha \(not loaded\)/);
	await h.read("alpha");
	assert.equal(markers(h.session).length, 1);
	assert.equal(h.session.getEntries().filter((entry) => entry.customType === SKILL_LOADED_ENTRY).length, 2);
	assert.match(await h.show(), /alpha \(~/);
});

test("sibling navigation and startup restore only active-branch markers", async () => {
	const h = setup();
	const root = h.session.appendCustomEntry("test-root", {});
	await h.read("alpha");
	const alphaLeaf = h.session.getLeafId();
	await h.navigate(root);
	await h.read("beta");
	const betaLeaf = h.session.getLeafId();
	assert.match(await h.show(), /alpha \(not loaded\), beta \(~/);
	await h.navigate(alphaLeaf);
	assert.match(await h.show(), /alpha \(~.*beta \(not loaded\)/);
	await h.navigate(betaLeaf);
	assert.match(await h.show(), /alpha \(not loaded\), beta \(~/);
	// Reloading at a sibling must not resurrect markers elsewhere in the tree.
	await h.emit("session_start", { reason: "reload" });
	assert.match(await h.show(), /alpha \(not loaded\), beta \(~/);
});

for (const reason of ["new", "resume", "fork"]) {
	test(`session replacement (${reason}) restores destination markers and prompt`, async () => {
		const h = setup();
		await h.read("alpha");
		h.prompt = "x".repeat(400);
		await h.emit("agent_start");
		assert.match(await h.show(), /Pi base \+ other system instructions: ~100 tok/);
		h.session = SessionManager.inMemory(process.cwd());
		h.session.appendCustomEntry(SKILL_LOADED_ENTRY, { name: "beta", path: "/skills/beta/SKILL.md" });
		h.prompt = "x".repeat(800);
		await h.emit("session_start", { reason, previousSessionFile: "/previous-session.jsonl" });
		const output = await h.show();
		assert.match(output, /alpha \(not loaded\), beta \(~/);
		assert.match(output, /Pi base \+ other system instructions: ~200 tok/);
		await h.read("alpha");
		assert.deepEqual(markers(h.session).map((entry) => entry.data.name), ["beta", "alpha"]);
	});
}

test("tree navigation invalidates the captured effective prompt until the next agent start", async () => {
	const h = setup();
	const root = h.session.appendCustomEntry("test-root", {});
	h.prompt = "x".repeat(400);
	await h.emit("agent_start");
	h.prompt = "x".repeat(800);
	assert.match(await h.show(), /Pi base \+ other system instructions: ~100 tok/);
	await h.navigate(root);
	assert.match(await h.show(), /Pi base \+ other system instructions: ~200 tok/);
	await h.emit("agent_start");
	h.prompt = "x".repeat(1200);
	assert.match(await h.show(), /Pi base \+ other system instructions: ~200 tok/);
});

test("repeated reads neither rescan the branch nor rebuild the skill index or duplicate markers", async () => {
	const h = setup();
	await h.emit("session_start", { reason: "startup" });
	const before = h.reads;
	for (let i = 0; i < 20; i++) {
		await h.emit("agent_start");
		await h.read("alpha");
		await h.read("beta");
	}
	assert.deepEqual(h.reads, before);
	assert.deepEqual(markers(h.session).map((entry) => entry.data.name), ["alpha", "beta"]);
});
