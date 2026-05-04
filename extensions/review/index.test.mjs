import test from "node:test";
import assert from "node:assert/strict";
import reviewExtension from "./index.ts";

test("/review-start can retry after pac-review skill load failure without leaving active review state", async () => {
	const commands = new Map();
	const notifications = [];
	const appendedEntries = [];
	const sentMessages = [];
	let leafId;

	const pi = {
		registerCommand(name, definition) {
			commands.set(name, definition.handler);
		},
		on() {},
		exec: async (command, args) => {
			if (command === "git" && args[0] === "rev-parse" && args[1] === "--git-dir") {
				return { code: 0, stdout: ".git\n", stderr: "" };
			}
			throw new Error(`Unexpected exec call: ${command} ${args.join(" ")}`);
		},
		appendEntry(customType, data) {
			appendedEntries.push({ customType, data });
			if (customType === "review-anchor") {
				leafId = "anchor-1";
			}
		},
		setSessionName() {},
		sendUserMessage(message) {
			sentMessages.push(message);
		},
	};

	reviewExtension(pi, {
		loadPackageSkill: async () => null,
	});

	const handler = commands.get("review-start");
	assert.equal(typeof handler, "function");

	const ctx = {
		hasUI: true,
		cwd: process.cwd(),
		sessionManager: {
			getEntries: () => [],
			getBranch: () => [],
			getLeafId: () => leafId,
		},
		navigateTree: async () => ({ cancelled: false }),
		ui: {
			notify(message, level) {
				notifications.push({ message, level });
			},
			setWidget() {},
			setEditorText() {},
			select: async () => undefined,
		},
	};

	await handler("uncommitted", ctx);
	await handler("uncommitted", ctx);

	assert.deepEqual(appendedEntries, []);
	assert.deepEqual(sentMessages, []);
	assert.deepEqual(notifications, [
		{ message: "Could not load skills/pac-review/SKILL.md", level: "error" },
		{ message: "Could not load skills/pac-review/SKILL.md", level: "error" },
	]);
});
