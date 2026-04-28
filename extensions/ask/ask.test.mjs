import test from "node:test";
import assert from "node:assert/strict";
import {
	filterAskModeMessages,
	getAskModeStateFromBranch,
	handleAskCommand,
} from "./helpers.ts";

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
