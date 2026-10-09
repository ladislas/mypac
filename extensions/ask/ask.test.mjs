import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { RpcClient } from "@earendil-works/pi-coding-agent";
import askExtension from "./index.ts";
import {
	ASK_MODE_TOOLS,
	filterAskModeMessages,
	getAskModeStateFromBranch,
	handleAskCommand,
} from "./helpers.ts";

function createAskHarness() {
	let activeTools = ["read", "bash", "edit", "write", "todo"];
	const commands = new Map();
	const events = new Map();
	const messages = [];
	const pi = {
		on(name, handler) { events.set(name, handler); },
		registerCommand(name, definition) { commands.set(name, definition); },
		getActiveTools: () => [...activeTools],
		setActiveTools(tools) {
			activeTools = [...tools];
		},
		appendEntry() {},
		sendMessage: (message, options) => messages.push({ message, options }),
		sendUserMessage() {},
	};
	askExtension(pi);
	assert.ok(commands.has("ask"), "/ask command should be registered");
	const ctx = {
		ui: {
			theme: { fg: (_color, text) => text },
			setStatus() {},
			notify() {},
		},
		sessionManager: { getBranch: () => [] },
	};
	return { handler: commands.get("ask").handler, ctx, events, messages, getActiveTools: () => activeTools,
		activateLateTool: (name) => { activeTools.push(name); } };
}

test("/ask changes tools dynamically and injects no-turn mode markers", async () => {
	const harness = createAskHarness();
	await harness.handler("", harness.ctx);

	assert.deepEqual(harness.getActiveTools(), ASK_MODE_TOOLS);
	assert.deepEqual(harness.messages[0].options, { triggerTurn: false });
	assert.equal(harness.messages[0].message.customType, "ask-mode-context");

	await harness.handler("", harness.ctx);
	assert.deepEqual(harness.getActiveTools(), ["read", "bash", "edit", "write", "todo"]);
	assert.deepEqual(harness.messages[1].options, { triggerTurn: false });
	assert.equal(harness.messages[1].message.customType, "ask-mode-end");
});

test("Ask mode reasserts the read-only request surface after late tool activation", async () => {
	const harness = createAskHarness();
	await harness.handler("", harness.ctx);
	harness.activateLateTool("mcp__fixture__write");
	await harness.events.get("before_agent_start")({ prompt: "question" }, harness.ctx);
	assert.deepEqual(harness.getActiveTools(), ASK_MODE_TOOLS);
	assert.deepEqual(await harness.events.get("tool_call")({ toolName: "mcp__fixture__write" }, harness.ctx),
		{ block: true, reason: "Ask mode permits read only" });
	assert.equal(await harness.events.get("tool_call")({ toolName: "read" }, harness.ctx), undefined);
	await harness.handler("", harness.ctx);
	assert.equal(await harness.events.get("tool_call")({ toolName: "mcp__fixture__write" }, harness.ctx), undefined);
	assert.deepEqual(harness.getActiveTools(), ["read", "bash", "edit", "write", "todo"]);
});

test("pinned runtime keeps Ask mode read-only when a direct MCP tool registers late", async () => {
	const directory = await mkdtemp(join(tmpdir(), "pac-ask-mcp-"));
	const agentDirectory = join(directory, "agent");
	await mkdir(agentDirectory);
	const server = join(directory, "server.mjs");
	const calledPath = join(directory, "called.txt");
	await writeFile(server, `import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  if (request.id === undefined) continue;
  if (request.method === "tools/call") writeFileSync(${JSON.stringify(calledPath)}, "called");
  if (request.method === "tools/list") await new Promise((resolve) => setTimeout(resolve, 1200));
  const result = request.method === "initialize"
    ? { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "fixture", version: "1" } }
    : request.method === "tools/list"
      ? { tools: [{ name: "write", description: "Unsafe tool", inputSchema: { type: "object", properties: {} } }] }
      : { content: [{ type: "text", text: "ok" }] };
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }) + "\\n");
}`);
	await writeFile(join(agentDirectory, "mcp.json"), JSON.stringify({ mcpServers: {
		fixture: { command: process.execPath, args: [server], exposure: "direct" },
	} }));
	const probePath = join(directory, "tools.json");
	const requestPath = join(directory, "request.json");
	const probe = join(directory, "probe.mjs");
	const aiModule = fileURLToPath(new URL("../../node_modules/@earendil-works/pi-ai/dist/index.js", import.meta.url));
	await writeFile(probe, `import { writeFileSync } from "node:fs";
import { createAssistantMessageEventStream, getCurrentTools } from ${JSON.stringify(aiModule)};
export default function (pi) {
  let attempted = false;
  pi.registerProvider("ask-fixture", {
    api: "openai-completions", apiKey: "fixture", baseUrl: "http://127.0.0.1:1",
    models: [{ id: "local", name: "Local", reasoning: false, input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 10000, maxTokens: 1000 }],
    streamSimple(model, context) {
      writeFileSync(${JSON.stringify(requestPath)}, JSON.stringify(getCurrentTools(context.messages).map(({ name }) => name)));
      const stream = createAssistantMessageEventStream();
      const unsafe = context.messages.some((item) => item.role === "user" && JSON.stringify(item.content).includes("Attempt unsafe call")) && !attempted;
      if (unsafe) attempted = true;
      const message = { role: "assistant", content: unsafe
        ? [{ type: "toolCall", id: "fixture-call", name: "mcp__fixture__write", arguments: {} }]
        : [{ type: "text", text: "ok" }],
        api: model.api, provider: model.provider, model: model.id, stopReason: unsafe ? "toolUse" : "stop", timestamp: Date.now(),
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
      queueMicrotask(() => { stream.push({ type: "start", partial: message });
        stream.push({ type: "done", reason: message.stopReason, message }); stream.end(); });
      return stream;
    },
  });
  pi.registerCommand("ask_probe", { description: "Inspect active tools", handler: async (_args, ctx) => {
    writeFileSync(${JSON.stringify(probePath)}, JSON.stringify({ active: pi.getActiveTools(), registered: pi.getAllTools().map(({ name }) => name), branch: ctx.sessionManager.getBranch().filter(({ customType }) => customType === "ask-mode-state") }));
  } });
  pi.registerCommand("ask_reload", { description: "Reload", handler: async (_args, ctx) => { await ctx.reload(); } });
}`);
	const cliPath = fileURLToPath(new URL("../../node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js", import.meta.url));
	const client = new RpcClient({ cliPath, cwd: directory,
		env: { ...process.env, PI_CODING_AGENT_DIR: agentDirectory },
		args: ["--session-dir", join(directory, "sessions"), "--model", "ask-fixture/local", "--extension", fileURLToPath(new URL("./index.ts", import.meta.url)), "--extension", probe],
	});
	async function requestTools(expected) {
		const settled = new Promise((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error("fixture model did not settle")), 5000);
			const unsubscribe = client.onEvent((event) => {
				if (event.type === "agent_settled") { clearTimeout(timeout); unsubscribe(); resolve(); }
			});
		});
		await client.prompt("Explain without modifying files");
		await settled;
		assert.deepEqual(JSON.parse(await readFile(requestPath, "utf8")), expected);
	}
	try {
		await client.start();
		await client.prompt("/ask_probe");
		const originalTools = JSON.parse(await readFile(probePath, "utf8")).active;
		assert.equal(await client.prompt("/ask"), "handled");
		let observed;
		for (let attempt = 0; attempt < 80; attempt++) {
			await client.prompt("/ask_probe");
			observed = JSON.parse(await readFile(probePath, "utf8"));
			if (observed.registered.includes("mcp__fixture__write")) break;
			await delay(50);
		}
		assert.ok(observed.registered.includes("mcp__fixture__write"), `fixture did not connect: ${client.getStderr()}`);
		// Activation occurs between turns; request preparation must reapply Ask's loadout.
		assert.deepEqual(observed.active, ["read", "mcp__fixture__write"]);
		await requestTools(ASK_MODE_TOOLS);
		const unsafeSettled = new Promise((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error("unsafe probe did not settle")), 5000);
			const unsubscribe = client.onEvent((event) => {
				if (event.type === "agent_settled") { clearTimeout(timeout); unsubscribe(); resolve(); }
			});
		});
		await client.prompt("Attempt unsafe call");
		await unsafeSettled;
		const toolResults = (await client.getMessages()).filter(({ role }) => role === "toolResult");
		assert.ok(toolResults.some(({ isError, content }) => isError && JSON.stringify(content).includes("Tool mcp__fixture__write not found")));
		await assert.rejects(access(calledPath), { code: "ENOENT" });
		const sessionFile = (await client.getState()).sessionFile;
		assert.ok(sessionFile);
		await client.newSession();
		await client.switchSession(sessionFile);
		await client.prompt("/ask_probe");
		const afterResume = JSON.parse(await readFile(probePath, "utf8"));
		assert.deepEqual(afterResume.active, ASK_MODE_TOOLS, JSON.stringify(afterResume.branch));
		await requestTools(ASK_MODE_TOOLS);
		await client.prompt("/ask_reload");
		await client.prompt("/ask_probe");
		const afterReload = JSON.parse(await readFile(probePath, "utf8"));
		assert.deepEqual(afterReload.active, ASK_MODE_TOOLS, JSON.stringify(afterReload.branch));
		await requestTools(ASK_MODE_TOOLS);
		await client.prompt("/ask");
		await client.prompt("/ask_probe");
		const restored = JSON.parse(await readFile(probePath, "utf8")).active;
		assert.deepEqual(restored, originalTools);
		await requestTools(originalTools);
	} finally {
		await client.stop();
	}
});

test("removes ask-mode-context custom messages", () => {
	const messages = [
		{ customType: "ask-mode-context", content: "[ASK MODE ACTIVE]\n...", display: false },
		{ role: "user", content: "hello" },
	];
	const result = filterAskModeMessages(messages);
	assert.equal(result.length, 1);
	assert.deepEqual(result[0], { role: "user", content: "hello" });
});

test("keeps user messages with [ASK MODE ACTIVE] string content", () => {
	const messages = [
		{ role: "user", content: "[ASK MODE ACTIVE]\nDo not make changes." },
		{ role: "user", content: "normal message" },
	];
	const result = filterAskModeMessages(messages);
	assert.equal(result.length, 2);
});

test("keeps user messages with [ASK MODE ACTIVE] in array content", () => {
	const messages = [
		{ role: "user", content: [{ type: "text", text: "[ASK MODE ACTIVE]\nDo not make changes." }] },
		{ role: "user", content: [{ type: "text", text: "normal" }] },
	];
	const result = filterAskModeMessages(messages);
	assert.equal(result.length, 2);
});

test("keeps assistant messages regardless of content", () => {
	const messages = [
		{ role: "assistant", content: [{ type: "text", text: "I'm in ask mode and won't make changes." }] },
		{ role: "user", content: "normal" },
	];
	const result = filterAskModeMessages(messages);
	assert.equal(result.length, 2);
});

test("keeps ask-mode-end messages", () => {
	const messages = [
		{ customType: "ask-mode-end", content: "[ASK MODE ENDED]\n...", display: false },
		{ role: "user", content: "can you run bash?" },
	];
	const result = filterAskModeMessages(messages);
	assert.equal(result.length, 2);
});

test("keeps normal messages untouched", () => {
	const messages = [
		{ role: "user", content: "just a question" },
		{ role: "assistant", content: [{ type: "text", text: "here is the answer" }] },
	];
	const result = filterAskModeMessages(messages);
	assert.equal(result.length, 2);
});

test("returns empty array for empty input", () => {
	assert.deepEqual(filterAskModeMessages([]), []);
});

test("restores ask mode state from custom state entries", () => {
	const state = getAskModeStateFromBranch([
		{ type: "custom", customType: "ask-mode-state", data: { enabled: true, savedTools: ["read", "bash"] } },
		{ type: "custom", customType: "ask-mode-state", data: { enabled: false, savedTools: [] } },
	]);

	assert.deepEqual(state, { enabled: false, savedTools: [] });
});

test("derives legacy ask mode state from custom messages", () => {
	const enabled = getAskModeStateFromBranch([
		{ type: "custom_message", customType: "ask-mode-context" },
	]);
	assert.deepEqual(enabled, { enabled: true, savedTools: undefined });

	const disabled = getAskModeStateFromBranch([
		{ type: "custom_message", customType: "ask-mode-context" },
		{ type: "custom_message", customType: "ask-mode-end" },
	]);
	assert.deepEqual(disabled, { enabled: false, savedTools: undefined });
});

test("/ask <message> enters ask mode and sends the trimmed message when inactive", () => {
	const events = [];

	handleAskCommand(false, "  should we refactor this?  ", {
		enterAskMode: () => events.push("enter"),
		exitAskMode: () => events.push("exit"),
		sendUserMessage: (message) => events.push(["message", message]),
	});

	assert.deepEqual(events, ["enter", ["message", "should we refactor this?"]]);
});

test("/ask with no trailing text exits ask mode when active", () => {
	const events = [];

	handleAskCommand(true, undefined, {
		enterAskMode: () => events.push("enter"),
		exitAskMode: () => events.push("exit"),
		sendUserMessage: (message) => events.push(["message", message]),
	});

	assert.deepEqual(events, ["exit"]);
});

test("/ask <message> exits ask mode before sending the message when active", () => {
	const events = [];

	handleAskCommand(true, "  okay let's do that  ", {
		enterAskMode: () => events.push("enter"),
		exitAskMode: () => events.push("exit"),
		sendUserMessage: (message) => events.push(["message", message]),
	});

	assert.deepEqual(events, ["exit", ["message", "okay let's do that"]]);
});
