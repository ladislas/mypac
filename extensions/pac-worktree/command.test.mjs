import test from "node:test";
import assert from "node:assert/strict";
import extension from "./index.ts";

function harness(respond, ui = {}) {
	const commands = new Map();
	const calls = [];
	const notices = [];
	const events = new Map();
	const pi = {
		registerCommand: (name, command) => commands.set(name, command),
		on: (name, handler) => events.set(name, handler),
		async exec(command, args, options) {
			calls.push([command, args, options]);
			return { code: 0, stderr: "", stdout: "", ...await respond(command, args, options) };
		},
	};
	extension(pi);
	return { commands, calls, notices, events, run: (args) => commands.get("pac-worktree").handler(args, {
		cwd: "/repo", hasUI: true, mode: "tui",
		ui: { notify: (text, level) => notices.push([text, level]), ...ui },
	}) };
}

test("direct issue URLs reject other repositories before Worktrunk mutation", async () => {
	const h = harness((command, args) => {
		assert.equal(command, "gh");
		assert.equal(args[0], "repo");
		return { stdout: "ladislas/mypac\n" };
	});
	await h.run("https://github.com/other/repo/issues/550");
	assert.equal(h.calls.length, 1);
	assert.match(h.notices.at(-1)[0], /Expected ladislas\/mypac.*other\/repo/);
});

export { harness };
