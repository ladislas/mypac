import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launchPi, buildLaunchCommand } from "./launcher.ts";
import { manualCommand } from "./helpers.ts";

const issue = "https://github.com/ladislas/mypac/issues/550";
const runtime = { platform: "darwin", env: { TERM_PROGRAM: "iTerm.app" } };

test("manual recovery is one line and shell-safe even for punctuation in branch names", () => {
	const branch = "ladislas/feature/550-quote'and;$HOME";
	const command = manualCommand(branch);
	assert.equal(command.includes("\n"), false);
	const output = execFileSync("/bin/sh", ["-c", `wt() { printf '%s\\0' "$@"; }; ${command}`]).toString().split("\0").filter(Boolean);
	assert.deepEqual(output, ["switch", branch, "-x", "pi"]);
});

test("iTerm launch creates a new window via a static script and argv, never write text", async () => {
	const calls = [];
	const path = `/tmp/a 'quote' "double" \\ slash $HOME \`id\`; touch /tmp/nope\nline`;
	const result = await launchPi({ exec: async (...args) => { calls.push(args); return { code: 0, stdout: "", stderr: "" }; } }, path, issue, runtime);
	assert.equal(result.ok, true);
	assert.equal(calls.length, 1);
	const [command, args] = calls[0];
	assert.equal(command, "/usr/bin/osascript");
	assert.match(args[1], /create window with default profile command/);
	assert.doesNotMatch(args[1], /write text|pac-lwot/);
	assert.equal(args[2], "--");
	assert.equal(args[3], buildLaunchCommand(path, issue));
	assert.ok(!args[1].includes(path));
});

test("shell command preserves arbitrary cwd and keeps prompt out of Pi positional args", { skip: process.platform !== "darwin" }, () => {
	const root = realpathSync(mkdtempSync(join(tmpdir(), "pac-launch-")));
	try {
		const path = join(root, `a 'quote' "double" \\ slash $HOME \`id\`; echo injected\nline`);
		mkdirSync(path);
		const fakePi = join(root, "pi");
		writeFileSync(fakePi, '#!/bin/sh\nprintf "%s\\0" "$PWD" "$PAC_WORKTREE_DRAFT_ISSUE" "$#"\n', { mode: 0o755 });
		// Replace only the executable boundary; preserve both real shell quoting layers.
		const command = buildLaunchCommand(path, issue).replace(/ pi'$/, ` ${fakePi}'`);
		const output = execFileSync("/bin/sh", ["-c", command]).toString().split("\0").filter(Boolean);
		assert.deepEqual(output, [path, issue, "0"]);
	} finally { rmSync(root, { recursive: true, force: true }); }
});

for (const env of [{ TERM_PROGRAM: "Apple_Terminal" }, {}]) {
	test(`unsupported terminal ${JSON.stringify(env)} does not launch`, async () => {
		const result = await launchPi({ exec: async () => assert.fail("must not execute") }, "/repo", issue, { platform: "darwin", env });
		assert.equal(result.ok, false); assert.match(result.error, /iTerm/);
	});
}

test("iTerm session ID is accepted but non-macOS is rejected", async () => {
	const pi = { exec: async () => ({ code: 0, stdout: "", stderr: "" }) };
	assert.equal((await launchPi(pi, "/repo", undefined, { platform: "darwin", env: { ITERM_SESSION_ID: "w0t0" } })).ok, true);
	assert.equal((await launchPi(pi, "/repo", issue, { platform: "linux", env: runtime.env })).ok, false);
});

test("AppleScript errors and thrown spawn failures are recoverable", async () => {
	for (const exec of [async () => ({ code: 1, stdout: "", stderr: "Automation denied" }), async () => { throw new Error("spawn failed"); }]) {
		const result = await launchPi({ exec }, "/repo", issue, runtime);
		assert.equal(result.ok, false); assert.match(result.error, /Automation denied|spawn failed/);
	}
});
