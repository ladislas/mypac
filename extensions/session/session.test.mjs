import test from "node:test";
import assert from "node:assert/strict";
import sessionExtension from "./index.ts";
import { buildSessionStats, buildSessionText } from "./session.ts";

const messages = [
	{ role: "user", content: [{ type: "text", text: "Hello" }], timestamp: 1 },
	{
		role: "assistant",
		content: [
			{ type: "text", text: "Working" },
			{ type: "toolCall", id: "call-1", name: "read", arguments: { path: "README.md" } },
		],
		usage: { input: 100, output: 20, cacheRead: 80, cacheWrite: 10, cost: { total: 0.0123 } },
		stopReason: "toolUse",
		timestamp: 2,
	},
	{
		role: "toolResult",
		toolCallId: "call-1",
		toolName: "read",
		content: [{ type: "text", text: "content" }],
		usage: { input: 2, output: 1, cacheRead: 3, cacheWrite: 0, cost: { total: 0.001 } },
		isError: false,
		timestamp: 3,
	},
];

function createContext(mode = "tui") {
	const customCalls = [];
	const customComponents = [];
	let customDone = 0;
	return {
		mode,
		sessionManager: {
			getEntries: () => [
				...messages.map((message, index) => ({ type: "message", id: `entry-${index}`, parentId: index ? `entry-${index - 1}` : null, timestamp: new Date().toISOString(), message })),
				{ type: "compaction", id: "compaction-1", parentId: "entry-2", timestamp: new Date().toISOString(), summary: "summary", firstKeptEntryId: "entry-0", tokensBefore: 100, usage: { input: 5, output: 2, cacheRead: 0, cacheWrite: 1, cost: { total: 0.002 } } },
			],
			getLeafId: () => "entry-2",
			getSessionFile: () => "/tmp/session.jsonl",
			getSessionId: () => "session-123",
			getSessionName: () => "Transient session",
		},
		ui: {
			custom: async (factory) => {
				customCalls.push(factory);
				customComponents.push(factory({}, { fg: (_tone, text) => text, bold: (text) => text }, {}, () => { customDone += 1; }));
			},
		},
		customCalls,
		customComponents,
		get customDone() { return customDone; },
	};
}

test("builds session statistics from public session entries", () => {
	const stats = buildSessionStats(createContext());

	assert.deepEqual(stats, {
		name: "Transient session",
		file: "/tmp/session.jsonl",
		id: "session-123",
		messages: { total: 3, user: 1, assistant: 1, toolCalls: 1, toolResults: 1 },
		tokens: { input: 107, output: 23, cacheRead: 83, cacheWrite: 11, total: 224 },
		cost: 0.0153,
	});
});

test("renders the session summary as plain text", () => {
	const text = buildSessionText(buildSessionStats(createContext()));

	assert.match(text, /^Session Info/m);
	assert.match(text, /Name: Transient session/);
	assert.match(text, /Total: 3/);
	assert.match(text, /Cached: 83 \(41\.3%\)/);
	assert.match(text, /Total: \$0\.015/);
});

test("registers /session-info as a transient TUI command", async () => {
	const commands = new Map();
	const sentMessages = [];
	const pi = {
		registerCommand: (name, definition) => commands.set(name, definition),
		sendMessage: (...args) => sentMessages.push(args),
	};
	sessionExtension(pi);
	const ctx = createContext();

	await commands.get("session-info").handler("", ctx);

	assert.equal(ctx.customCalls.length, 1);
	assert.match(ctx.customComponents[0].render(80).join("\n"), /Transient session/);
	ctx.customComponents[0].handleInput("q");
	assert.equal(ctx.customDone, 1);
	assert.deepEqual(sentMessages, []);
});
