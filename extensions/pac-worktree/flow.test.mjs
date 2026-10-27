import test from "node:test";
import assert from "node:assert/strict";
import extension, { ensureWorktree } from "./index.ts";

function withDraft(value, fn) {
	const previous = process.env.PAC_WORKTREE_DRAFT_ISSUE;
	if (value === undefined) delete process.env.PAC_WORKTREE_DRAFT_ISSUE;
	else process.env.PAC_WORKTREE_DRAFT_ISSUE = value;
	return Promise.resolve().then(fn).finally(() => {
		if (previous === undefined) delete process.env.PAC_WORKTREE_DRAFT_ISSUE;
		else process.env.PAC_WORKTREE_DRAFT_ISSUE = previous;
	});
}

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

for (const branch of [
	"scratch/550-not-an-issue", "ladislas/chore/550-maintenance", "feature/550-no-owner",
	"archive/ladislas/feature/550-copy", "ladislas/feature/topic/550-nested", "ladislas/feature/550",
	"ladislas/feature/5500-other",
]) {
	test(`unrelated numeric branch ${branch} is not selected as an issue worktree`, async () => {
		const h = setup({ entries: [{ branch, path: "/unrelated" }], branches: [branch] });
		await h.run("550 --type bugfix");
		assert.deepEqual(h.calls.find(({ args }) => args[0] === "switch")?.args,
			["switch", "--create", "--no-cd", "ladislas/bugfix/550-a-new-title"]);
	});
}

for (const branch of ["alice/feature/550-original-title", "ladislas/bugfix/550_original_title", "ladislas/release/550-original-title"]) {
	test(`recognized branch ${branch} is reused despite unrelated numeric branches and a type override`, async () => {
		const h = setup({ entries: [{ branch, path: "/old/path" }], branches: ["scratch/550-not-an-issue", "ladislas/chore/550-other"] });
		await h.run("550 --type bugfix");
		assert.ok(h.notices.some(({ text }) => text.includes("Reusing existing worktree") && text.includes(branch)));
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

test("completion offers static commands rather than an unrelated real issue", () => {
	const h = setup(); const command = h.commands.get("pac-worktree");
	const complete = command.getArgumentCompletions;
	assert.deepEqual(complete("").map(({ value }) => value), ["branch ", "list", "status"]);
	assert.deepEqual(complete("st").map(({ value }) => value), ["status"]);
	assert.equal(complete("550"), null);
	assert.equal(complete("https://github.com/"), null);
	assert.match(command.description, /<issue-number-or-url>/);
});

test("completion supplies type guidance only for the issue target the user entered", () => {
	const complete = setup().commands.get("pac-worktree").getArgumentCompletions;
	for (const target of ["123", "https://github.com/owner/repo/issues/42"]) {
		assert.deepEqual(complete(`${target} `).map(({ value }) => value), [`${target} --type `]);
		assert.deepEqual(complete(`${target} --type b`).map(({ value }) => value), [`${target} --type bugfix`]);
	}
	for (const prefix of ["branch ", "branch --type b", "list ", "not-an-issue "]) {
		assert.ok((complete(prefix) ?? []).every(({ value }) => !value.includes("--type")));
	}
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

test("child startup fills the editable editor once without sending a message", async () => {
	const h = setup(); const texts = [];
	h.ctx.ui.setEditorText = (text) => texts.push(text);
	await withDraft("https://github.com/ladislas/mypac/issues/550", async () => {
		await h.events.get("session_start")({}, h.ctx);
		assert.equal(process.env.PAC_WORKTREE_DRAFT_ISSUE, undefined);
		await h.events.get("session_start")({}, h.ctx);
	});
	assert.deepEqual(texts, ["/pac-lwot https://github.com/ladislas/mypac/issues/550"]);
	assert.equal(h.calls.length, 0);
});

for (const [mode, draft] of [["rpc", "https://github.com/ladislas/mypac/issues/550"], ["tui", "not an issue"], ["tui", undefined]]) {
	test(`startup does not prefill for ${mode}, ${draft}`, async () => {
		const h = setup(); h.ctx.mode = mode;
		h.ctx.ui.setEditorText = () => assert.fail("must not prefill");
		await withDraft(draft, () => h.events.get("session_start")({}, h.ctx));
	});
}

for (const entries of [[], [{ branch: "ladislas/feature/550-old", path: "/old/path" }]]) {
	test(`new and reused worktrees launch in their exact path (${entries.length})`, { skip: process.platform !== "darwin" }, async () => {
		const previous = process.env.TERM_PROGRAM;
		try {
			process.env.TERM_PROGRAM = "iTerm.app";
			const h = setup({ entries }); await h.run("550");
			const call = h.calls.find(({ command }) => command === "/usr/bin/osascript");
			assert.ok(call);
			const { buildLaunchCommand } = await import("./launcher.ts");
			assert.equal(call.args.at(-1), buildLaunchCommand(entries.length ? "/old/path" : "/tmp/my 'worktree", "https://github.com/ladislas/mypac/issues/550"));
			assert.match(h.notices.at(-1).text, /Opened a new iTerm window/);
		} finally {
			if (previous === undefined) delete process.env.TERM_PROGRAM;
			else process.env.TERM_PROGRAM = previous;
		}
	});
}

test("launch failure retains worktree and reports a one-line recovery command", { skip: process.platform !== "darwin" }, async () => {
	const previous = process.env.TERM_PROGRAM;
	try {
		process.env.TERM_PROGRAM = "iTerm.app";
		const h = setup({ launchResult: { code: 1, stdout: "", stderr: "Automation denied" } });
		await h.run("550");
		const text = h.notices.at(-1).text;
		assert.match(text, /Created worktree/);
		assert.match(text, /Automation denied/);
		assert.match(text, /Worktree retained/);
		assert.match(text, /^wt switch ladislas\/feature\/550-a-new-title -x pi$/m);
		assert.equal(h.calls.filter(({ args }) => args[0] === "switch").length, 1);
	} finally {
		if (previous === undefined) delete process.env.TERM_PROGRAM;
		else process.env.TERM_PROGRAM = previous;
	}
});
