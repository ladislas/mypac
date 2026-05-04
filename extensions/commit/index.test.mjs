import test from "node:test";
import assert from "node:assert/strict";
import commitExtension from "./index.ts";

test("/commit exits before switching models when pac-commit skill is missing", async () => {
	const commands = new Map();
	const notifications = [];
	const setModelCalls = [];
	const sentMessages = [];

	const pi = {
		registerCommand(name, definition) {
			commands.set(name, definition.handler);
		},
		on() {},
		exec: async (command, args) => {
			if (command === "git" && args[0] === "rev-parse") {
				return { code: 0, stdout: "true\n", stderr: "" };
			}
			if (command === "git" && args[0] === "status") {
				return { code: 0, stdout: " M README.md\n", stderr: "" };
			}
			throw new Error(`Unexpected exec call: ${command} ${args.join(" ")}`);
		},
		setModel: async (model) => {
			setModelCalls.push(model);
			return true;
		},
		sendUserMessage(message) {
			sentMessages.push(message);
		},
	};

	commitExtension(pi, {
		loadPackageSkill: async () => null,
	});

	const handler = commands.get("commit");
	assert.equal(typeof handler, "function");

	await handler("", {
		isIdle: () => true,
		cwd: process.cwd(),
		model: { provider: "anthropic", id: "claude-sonnet" },
		modelRegistry: {
			find: () => ({ provider: "openai-codex", id: "gpt-5.4-mini" }),
		},
		ui: {
			notify(message, level) {
				notifications.push({ message, level });
			},
		},
	});

	assert.deepEqual(setModelCalls, []);
	assert.deepEqual(sentMessages, []);
	assert.deepEqual(notifications, [
		{ message: "Could not load skills/pac-commit/SKILL.md", level: "error" },
	]);
});
