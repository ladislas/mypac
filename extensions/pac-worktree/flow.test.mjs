import test from "node:test";
import assert from "node:assert/strict";
import extension, { ensureWorktree } from "./index.ts";

function setup({ entries = [], branches = [], labels = [], approvals = { state: "approved", commands: [] }, switchResult, launchResult } = {}) {
	const calls = [], notices = [], commands = new Map(), events = new Map();
	let createdBranch;
	const pi = {
		registerCommand: (name, command) => commands.set(name, command),
		on: (name, handler) => events.set(name, handler),
		async exec(command, args, options) {
			calls.push({ command, args, options });
			const success = (stdout = "") => ({ code: 0, stderr: "", stdout: typeof stdout === "string" ? stdout : JSON.stringify(stdout) });
			if (command === "gh") return success(args[0] === "repo" ? "ladislas/mypac" : { number: 550, title: "A new title", url: "https://github.com/ladislas/mypac/issues/550", labels });
			if (command === "git") {
				if (args[0] === "for-each-ref") return success(branches.join("\n"));
				if (args[0] === "show-ref") return { ...success(), code: branches.includes(args.at(-1).replace("refs/heads/", "")) ? 0 : 1 };
				if (args[0] === "check-ref-format") return success();
			}
			if (command === "wt") {
				if (args[0] === "list") return success(createdBranch ? [...entries, { branch: createdBranch, path: "/tmp/my 'worktree" }] : entries);
				if (args[0] === "config") return success(approvals);
				if (args[0] === "switch") { createdBranch = args.at(-1); return switchResult ?? success(); }
			}
			if (command === "/usr/bin/osascript") return launchResult ?? success();
			throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
		},
	};
	extension(pi);
	const ctx = { cwd: "/repo", mode: "tui", hasUI: true, ui: { notify: (text, level) => notices.push({ text, level }) } };
	return { calls, notices, commands, events, pi, ctx, run: (args) => commands.get("pac-worktree").handler(args, ctx) };
}

for (const input of ["550", "https://github.com/LADISLAS/MYPAC/issues/550"]) {
	test(`direct ${input} reuses exact issue identity after title changes`, async () => {
		const branch = "ladislas/bugfix/550-original-title";
		const h = setup({ entries: [{ branch, path: "/old/path" }, { branch: "ladislas/feature/5500-other", path: "/other" }] });
		await h.run(input);
		assert.ok(h.notices.some(({ text }) => text.includes(`Reusing existing worktree for #550`) && text.includes(branch)));
		assert.equal(h.calls.filter(({ args }) => args[0] === "switch").length, 0);
	});
}

test("ambiguous historical issue branches fail clearly without mutation", async () => {
	const h = setup({ entries: [{ branch: "ladislas/feature/550-old", path: "/old" }], branches: ["ladislas/bugfix/550-other"] });
	await h.run("550");
	assert.match(h.notices.at(-1).text, /Multiple branches.*550-old.*550-other/);
	assert.equal(h.calls.filter(({ args }) => args[0] === "switch").length, 0);
});

for (const [input, labels, expected] of [
	["550", [], "feature"], ["550", [{ name: "bug" }], "bugfix"],
	["550 --type feature", [{ name: "bug" }], "feature"], ["550 --type bugfix", [], "bugfix"], ["550 --type release", [], "release"],
]) {
	test(`${input}, labels ${JSON.stringify(labels)} creates ${expected} branch`, async () => {
		const h = setup({ labels });
		await h.run(input);
		const call = h.calls.find(({ args }) => args[0] === "switch");
		assert.deepEqual(call.args, ["switch", "--create", "--no-cd", `ladislas/${expected}/550-a-new-title`]);
		assert.ok(h.notices.some(({ text }) => text.includes("Created worktree")));
	});
}

test("an existing issue branch without a worktree is reused even with an override", async () => {
	const h = setup({ branches: ["ladislas/feature/550-old"] });
	await h.run("550 --type bugfix");
	assert.deepEqual(h.calls.find(({ args }) => args[0] === "switch").args, ["switch", "--no-cd", "ladislas/feature/550-old"]);
});

for (const input of ["0", "-1", "9007199254740992", "550 --type nope", "550 extra", "https://github.com/ladislas/mypac/issues/550/extra", "http://github.com/ladislas/mypac/issues/550", "branch --evil"]) {
	test(`invalid input ${input} makes no external calls`, async () => {
		const h = setup(); await h.run(input);
		assert.equal(h.calls.length, 0);
		assert.equal(h.notices.at(-1).level, "error");
	});
}

for (const command of ["list", "ls", "status"]) {
	test(`${command} delegates to Worktrunk without mutation`, async () => {
		const h = setup({ entries: [{ branch: "main", path: "/repo", is_current: true }] });
		await h.run(command);
		assert.deepEqual(h.calls.map(({ command, args }) => [command, args]), [["wt", ["list", "--format=json"]]]);
		assert.match(h.notices.at(-1).text, /main/);
	});
}

test("bare command offers menu and dispatches prompted issue", async () => {
	const h = setup();
	h.ctx.ui.select = async (_title, options) => { assert.deepEqual(options, ["Issue", "Branch", "List", "Status"]); return "Issue"; };
	h.ctx.ui.input = async () => "550";
	await h.run("");
	assert.ok(h.calls.some(({ args }) => args[0] === "switch"));
});

test("menu cancellation and non-UI usage have no effects", async () => {
	const h = setup(); h.ctx.ui.select = async () => undefined;
	await h.run(""); assert.equal(h.calls.length, 0);
	h.ctx.hasUI = false; await h.run(""); assert.equal(h.calls.length, 0);
	assert.match(h.notices.at(-1).text, /Usage/);
});

test("completion supplies direct targets, operations and type overrides", () => {
	const h = setup(); const complete = h.commands.get("pac-worktree").getArgumentCompletions;
	assert.deepEqual(complete("st").map(({ value }) => value), ["status"]);
	assert.ok(complete("").some(({ value }) => value === "550"));
	assert.ok(complete("550 ").some(({ value }) => value === "550 --type "));
	assert.deepEqual(complete("550 --type b").map(({ value }) => value), ["550 --type bugfix"]);
});

for (const approvals of [
	{ state: "approval_required", commands: [{ template: "npm ci", approved: false }] },
	{ state: "approved", commands: [{ template: "changed command", approved: false }] },
	{ state: "unknown", commands: [] },
]) {
	test(`approval check fails closed for ${JSON.stringify(approvals)}`, async () => {
		const h = setup({ approvals }); await h.run("550");
		assert.equal(h.calls.filter(({ args }) => args[0] === "switch").length, 0);
		assert.equal(h.notices.at(-1).level, "error");
		if (approvals.state === "approval_required") {
			assert.match(h.notices.at(-1).text, /npm ci/);
			assert.match(h.notices.at(-1).text, /wt config approvals add/);
		}
	});
}

test("setup failure surfaces hook stderr and recovery without launch", async () => {
	const h = setup({ switchResult: { code: 1, stdout: "", stderr: "npm ci failed" } });
	await h.run("550");
	assert.match(h.notices.at(-1).text, /npm ci failed/);
	assert.match(h.notices.at(-1).text, /worktree may remain/);
	assert.equal(h.calls.filter(({ command }) => command === "/usr/bin/osascript").length, 0);
});

test("unsupported approval inspection never attempts creation", async () => {
	const calls = [];
	const result = await ensureWorktree({ exec: async (_command, args) => {
		calls.push(args); return args[0] === "list" ? { code: 0, stdout: "[]", stderr: "" } : { code: 1, stdout: "", stderr: "unsupported" };
	} }, "feature/test");
	assert.equal(result.ok, false); assert.match(result.error, /unsupported/);
	assert.equal(calls.length, 2);
});
