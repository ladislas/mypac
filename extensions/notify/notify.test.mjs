import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import notifyExtension from "./index.ts";
import { extractLastAssistantText, formatNotification, formatTerminalNotification } from "./helpers.ts";

function makeRpcCtx() {
	const notifications = [];
	return {
		ctx: {
			mode: "rpc",
			hasUI: true,
			ui: { notify: (message, level) => notifications.push({ message, level }) },
		},
		notifications,
	};
}

function registerExtension() {
	const commands = new Map();
	const events = new Map();
	notifyExtension({
		registerCommand: (name, definition) => commands.set(name, definition.handler),
		on: (event, handler) => events.set(event, handler),
	});
	return { commands, events };
}

test("RPC mode uses protocol notifications instead of terminal escape output", async () => {
	const { commands, events } = registerExtension();
	const { ctx, notifications } = makeRpcCtx();

	await commands.get("notify-test")("", ctx);
	assert.deepEqual(notifications, [{ message: "Pi test: Ready for input", level: "info" }]);

	await events.get("agent_end")({ messages: [{ role: "assistant", content: "Done" }] }, ctx);
	assert.deepEqual(notifications.length, 1, "agent_end must not emit a notification");

	await events.get("agent_settled")({}, ctx);
	assert.deepEqual(notifications, [
		{ message: "Pi test: Ready for input", level: "info" },
		{ message: "π: Done", level: "info" },
	]);
});

test("agent_settled emits last-staged content when multiple agent_end events fire before settling", async () => {
	const { events } = registerExtension();
	const { ctx, notifications } = makeRpcCtx();

	await events.get("agent_end")({ messages: [{ role: "assistant", content: "First attempt" }] }, ctx);
	await events.get("agent_end")({ messages: [{ role: "assistant", content: "Retried answer" }] }, ctx);

	assert.equal(notifications.length, 0, "no notification before settled");

	await events.get("agent_settled")({}, ctx);
	assert.equal(notifications.length, 1);
	assert.equal(notifications[0].message, "π: Retried answer");
});

test("agent_settled without a preceding agent_end emits a ready-for-input fallback", async () => {
	const { events } = registerExtension();
	const { ctx, notifications } = makeRpcCtx();

	await events.get("agent_settled")({}, ctx);
	assert.deepEqual(notifications, [{ message: "Ready for input", level: "info" }]);
});

test("agent_start clears stale pending so an interrupted turn does not ghost into the next run", async () => {
	const { events } = registerExtension();
	const { ctx, notifications } = makeRpcCtx();

	// Simulated interrupted turn: agent_end fires but agent_settled never does.
	await events.get("agent_end")({ messages: [{ role: "assistant", content: "Cancelled work" }] }, ctx);

	// Next turn starts: agent_start must clear the stale pending.
	await events.get("agent_start")({}, ctx);

	await events.get("agent_end")({ messages: [{ role: "assistant", content: "Real answer" }] }, ctx);
	await events.get("agent_settled")({}, ctx);

	assert.equal(notifications.length, 1, "only one notification — no ghost from the cancelled turn");
	assert.equal(notifications[0].message, "π: Real answer");
});

test("cancelled settlement preserves notification policy and does not leak into the next run", async () => {
	const { events } = registerExtension();
	const { ctx, notifications } = makeRpcCtx();
	await events.get("agent_end")({ messages: [{ role: "assistant", content: "Cancelled work" }] }, ctx);
	await events.get("agent_settled")({ aborted: true }, ctx);
	await events.get("agent_start")({}, ctx);
	await events.get("agent_end")({ messages: [{ role: "assistant", content: "New answer" }] }, ctx);
	await events.get("agent_settled")({ aborted: false }, ctx);
	assert.deepEqual(notifications.map(({ message }) => message), ["π: Cancelled work", "π: New answer"]);
});

test("pending notification is cleared after agent_settled so a second settled emits only a fallback", async () => {
	const { events } = registerExtension();
	const { ctx, notifications } = makeRpcCtx();

	await events.get("agent_end")({ messages: [{ role: "assistant", content: "Done" }] }, ctx);
	await events.get("agent_settled")({}, ctx);
	await events.get("agent_settled")({}, ctx);

	assert.equal(notifications.length, 2);
	assert.equal(notifications[0].message, "π: Done");
	assert.equal(notifications[1].message, "Ready for input");
});

test("pinned CLI print and JSON output contain no notification OSC bytes", async () => {
	const directory = await mkdtemp(join(tmpdir(), "pac-notify-cli-"));
	const fixture = join(directory, "provider.mjs");
	const aiModule = fileURLToPath(new URL("../../node_modules/@earendil-works/pi-ai/dist/index.js", import.meta.url));
	await writeFile(fixture, `import { createAssistantMessageEventStream } from ${JSON.stringify(aiModule)};
export default function (pi) {
  pi.registerProvider("notify-fixture", {
    api: "openai-completions", apiKey: "fixture", baseUrl: "http://127.0.0.1:1",
    models: [{ id: "local", name: "Local", reasoning: false, input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 10000, maxTokens: 1000 }],
    streamSimple(model) {
      const stream = createAssistantMessageEventStream();
      const message = { role: "assistant", content: [{ type: "text", text: "Ready" }],
        api: model.api, provider: model.provider, model: model.id, stopReason: "stop", timestamp: Date.now(),
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
      queueMicrotask(() => { stream.push({ type: "start", partial: message });
        stream.push({ type: "done", reason: "stop", message }); stream.end(); });
      return stream;
    },
  });
}`);
	const cli = fileURLToPath(new URL("../../node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js", import.meta.url));
	for (const mode of ["text", "json"]) {
		const { stdout, stderr } = await new Promise((resolve, reject) => {
			const child = execFile(process.execPath, [cli, "--mode", mode, "--print", "--offline", "--no-session",
				"--no-extensions", "--extension", fileURLToPath(new URL("./index.ts", import.meta.url)),
				"--extension", fixture, "--model", "notify-fixture/local", "--", "Say ready"],
				{ cwd: directory, env: { ...process.env, PI_CODING_AGENT_DIR: directory }, timeout: 15000 },
				(error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr }));
			child.stdin.end();
		});
		assert.doesNotMatch(stdout + stderr, /\x1b\]/, mode);
		assert.match(stdout, /Ready/, mode);
	}
});

test("extracts the last assistant string content", () => {
	const text = extractLastAssistantText([
		{ role: "assistant", content: "first" },
		{ role: "user", content: "question" },
		{ role: "assistant", content: "  final answer  " },
	]);

	assert.equal(text, "final answer");
});

test("extracts text parts from the last assistant array content", () => {
	const text = extractLastAssistantText([
		{
			role: "assistant",
			content: [
				{ type: "thinking", text: "ignore me" },
				{ type: "text", text: "line one" },
				{ type: "text", text: "line two" },
			],
		},
	]);

	assert.equal(text, "line one\nline two");
});

test("returns null when no assistant text is available", () => {
	assert.equal(extractLastAssistantText([{ role: "user", content: "hello" }]), null);
	assert.equal(extractLastAssistantText([{ role: "assistant", content: "   " }]), null);
});

test("skips assistant messages without extractable text", () => {
	const text = extractLastAssistantText([
		{ role: "assistant", content: "usable answer" },
		{ role: "assistant", content: [{ type: "tool-call", name: "bash" }] },
		{ role: "assistant", content: { type: "other" } },
	]);

	assert.equal(text, "usable answer");
});

test("formats empty text as a ready-for-input notification", () => {
	assert.deepEqual(formatNotification(null), { title: "Ready for input", body: "" });
});

test("formats markdown-like assistant text as a normalized notification body", () => {
	const notification = formatNotification("## Done\n\nThis is **ready** now.\n\n- Item one\n- Item two");

	assert.equal(notification.title, "π");
	assert.equal(notification.body, "Done This is ready now. Item one Item two");
});

test("truncates long notification bodies", () => {
	const notification = formatNotification("x".repeat(250));

	assert.equal(notification.body.length, 200);
	assert.equal(notification.body.endsWith("…"), true);
});

test("formats iTerm2 notifications with OSC 9", () => {
	assert.equal(
		formatTerminalNotification("Pi test", "Ready for input", { TERM_PROGRAM: "iTerm.app" }),
		"\x1b]9;Pi test: Ready for input\x07",
	);
});

test("formats default notifications with OSC 777", () => {
	assert.equal(
		formatTerminalNotification("π", "Ready for input", {}),
		"\x1b]777;notify;π;Ready for input\x07",
	);
});

test("detects iTerm2 from ITERM_SESSION_ID", () => {
	assert.equal(
		formatTerminalNotification("Pi test", "Ready for input", { ITERM_SESSION_ID: "session" }),
		"\x1b]9;Pi test: Ready for input\x07",
	);
});

test("formats Kitty notifications with OSC 99", () => {
	assert.equal(
		formatTerminalNotification("Pi test", "Ready for input", { KITTY_WINDOW_ID: "1" }),
		"\x1b]99;i=1:d=0;Pi test\x1b\\\x1b]99;i=1:p=body;Ready for input\x1b\\",
	);
});

test("wraps notifications for tmux passthrough", () => {
	assert.equal(
		formatTerminalNotification("Pi test", "Ready for input", { TERM_PROGRAM: "iTerm.app", TMUX: "/tmp/tmux" }),
		"\x1bPtmux;\x1b\x1b]9;Pi test: Ready for input\x07\x1b\\",
	);
});

test("sanitizes notification fields before formatting OSC sequences", () => {
	assert.equal(
		formatTerminalNotification("P;i\x07", "Ready\x1b]9;bad\x07;done", {}),
		"\x1b]777;notify;P,i;Ready]9,bad,done\x07",
	);
	assert.equal(
		formatTerminalNotification("P;i\x07", "Ready\x1b]9;bad\x07;done", { TERM_PROGRAM: "iTerm.app" }),
		"\x1b]9;P,i: Ready]9,bad,done\x07",
	);
	assert.equal(
		formatTerminalNotification("P;i\x07", "Ready\x1b]9;bad\x07;done", { KITTY_WINDOW_ID: "1" }),
		"\x1b]99;i=1:d=0;P,i\x1b\\\x1b]99;i=1:p=body;Ready]9,bad,done\x1b\\",
	);
});
