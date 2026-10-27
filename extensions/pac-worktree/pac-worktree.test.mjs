import test from "node:test";
import assert from "node:assert/strict";
import {
	buildIssueBranch,
	findWorktreeByBranch,
	formatIssueWorktreeSummary,
	formatBranchWorktreeSummary,
	formatCurrentWorktreeStatus,
	formatWorktreeList,
	parseIssueTarget,
	parseWorktrunkList,
	slugifyIssueTitle,
} from "./helpers.ts";
import { ensureWorktree } from "./index.ts";

test("parses a local issue number", () => {
	assert.deepEqual(parseIssueTarget("85"), { kind: "number", number: 85 });
});

test("parses a GitHub issue URL", () => {
	assert.deepEqual(parseIssueTarget("https://github.com/ladislas/mypac/issues/85"), {
		kind: "url",
		owner: "ladislas",
		repo: "mypac",
		number: 85,
	});
});

test("rejects invalid issue targets", () => {
	assert.equal(parseIssueTarget(""), null);
	assert.equal(parseIssueTarget("not-an-issue"), null);
	assert.equal(parseIssueTarget("https://example.com/ladislas/mypac/issues/85"), null);
	assert.equal(parseIssueTarget("https://github.com/ladislas/mypac/pull/85"), null);
});

test("slugifies issue titles", () => {
	assert.equal(slugifyIssueTitle("Adopt a Worktrunk-backed workflow for parallel Pi issue work"), "adopt-a-worktrunk-backed-workflow-for-parallel-pi-issue-work");
	assert.equal(slugifyIssueTitle("Fix: mise + npm setup!"), "fix-mise-npm-setup");
});

test("builds repo-convention issue branch names", () => {
	assert.equal(
		buildIssueBranch(85, "Adopt a Worktrunk-backed workflow"),
		"ladislas/feature/85-adopt-a-worktrunk-backed-workflow",
	);
});

test("parses Worktrunk list output", () => {
	const entries = parseWorktrunkList(`\n${JSON.stringify([
		{ branch: "main", path: "/repo", is_current: true },
		{ branch: "ladislas/feature/85-work", path: "/repo/.worktrees/85-work" },
	])}\n`);

	assert.deepEqual(entries, [
		{ branch: "main", path: "/repo", isCurrent: true, isMain: false },
		{ branch: "ladislas/feature/85-work", path: "/repo/.worktrees/85-work", isCurrent: false, isMain: false },
	]);
	assert.deepEqual(findWorktreeByBranch(entries, "ladislas/feature/85-work"), {
		branch: "ladislas/feature/85-work",
		path: "/repo/.worktrees/85-work",
		isCurrent: false,
		isMain: false,
	});
});

test("parses and renders Worktrunk list details", () => {
	const entries = parseWorktrunkList(JSON.stringify([
		{
			branch: "ladislas/feature/270-work",
			path: "/repo/.worktrees/270-work",
			is_current: true,
			commit: { short_sha: "abc1234", message: "Add worktree commands" },
			working_tree: { staged: false, modified: true, untracked: true, renamed: false, deleted: false, diff: { added: 3, deleted: 1 } },
			main_state: "ahead",
			main: { ahead: 1, behind: 0 },
		},
		{ branch: "main", path: "/repo", is_main: true },
	]));

	assert.equal(
		formatWorktreeList(entries),
		[
			"Worktrunk worktrees:",
			"- ladislas/feature/270-work (current)",
			"  Path: /repo/.worktrees/270-work",
			"  Open Pi: wt switch ladislas/feature/270-work -x pi",
			"- main (main)",
			"  Path: /repo",
			"  Open Pi: wt switch main -x pi",
		].join("\n"),
	);

	assert.equal(
		formatCurrentWorktreeStatus(entries),
		[
			"Current Worktrunk worktree:",
			"Branch: ladislas/feature/270-work",
			"Path: /repo/.worktrees/270-work",
			"Main: ahead 1, behind 0, state: ahead",
			"Commit: abc1234 - Add worktree commands",
			"Dirty: modified, untracked (+3/-1)",
		].join("\n"),
	);
});

test("formats branch worktree summaries", () => {
	assert.equal(
		formatBranchWorktreeSummary({ created: false, branch: "ladislas/feature/manual-work", path: "/tmp/manual work" }),
		[
			"Reusing existing worktree for branch: ladislas/feature/manual-work",
			"Path: /tmp/manual work",
			"",
			"Open Pi:",
			"wt switch ladislas/feature/manual-work -x pi",
		].join("\n"),
	);
});

test("creates new worktrees only after inspecting hook approval", async () => {
	const calls = [];
	const progress = [];
	const listBefore = JSON.stringify([{ branch: "main", path: "/repo" }]);
	const listAfter = JSON.stringify([
		{ branch: "main", path: "/repo" },
		{ branch: "ladislas/feature/85-work", path: "/repo/.worktrees/85-work" },
	]);
	const pi = {
		async exec(command, args) {
			calls.push([command, args]);
			if (calls.length === 1) return { code: 0, stdout: listBefore, stderr: "" };
			if (calls.length === 2) return { code: 0, stdout: '{"state":"approved","commands":[]}', stderr: "" };
			if (command === "git") return { code: 1, stdout: "", stderr: "" };
			if (command === "wt" && args[0] === "switch") return { code: 0, stdout: "", stderr: "" };
			return { code: 0, stdout: listAfter, stderr: "" };
		},
	};

	const result = await ensureWorktree(pi, "ladislas/feature/85-work", (message) => progress.push(message));

	assert.deepEqual(result, {
		ok: true,
		value: { created: true, path: "/repo/.worktrees/85-work" },
	});
	assert.deepEqual(calls, [
		["wt", ["list", "--format=json"]],
		["wt", ["config", "approvals", "list", "--format=json"]],
		["git", ["show-ref", "--verify", "--quiet", "refs/heads/ladislas/feature/85-work"]],
		["wt", ["switch", "--create", "--no-cd", "ladislas/feature/85-work"]],
		["wt", ["list", "--format=json"]],
	]);
	assert.deepEqual(progress, [
		"Checking Worktrunk worktrees...",
		"Creating Worktrunk worktree for ladislas/feature/85-work. This may run setup hooks...",
		"Verifying Worktrunk worktree...",
	]);
});

test("reuses an existing branch without passing --create", async () => {
	const calls = [];
	const pi = {
		async exec(command, args) {
			calls.push([command, args]);
			if (calls.length === 1) return { code: 0, stdout: JSON.stringify([{ branch: "main", path: "/repo" }]), stderr: "" };
			if (calls.length === 2) return { code: 0, stdout: '{"state":"no_commands","commands":[]}', stderr: "" };
			if (command === "git" || args[0] === "switch") return { code: 0, stdout: "", stderr: "" };
			return { code: 0, stdout: JSON.stringify([{ branch: "ladislas/feature/manual-work", path: "/repo/.worktrees/manual-work" }]), stderr: "" };
		},
	};

	const result = await ensureWorktree(pi, "ladislas/feature/manual-work");

	assert.deepEqual(result, {
		ok: true,
		value: { created: true, path: "/repo/.worktrees/manual-work" },
	});
	assert.deepEqual(calls[3], ["wt", ["switch", "--no-cd", "ladislas/feature/manual-work"]]);
});

test("reuses existing worktrees without creating", async () => {
	const calls = [];
	const pi = {
		async exec(command, args) {
			calls.push([command, args]);
			return {
				code: 0,
				stdout: JSON.stringify([{ branch: "ladislas/feature/manual-work", path: "/repo/.worktrees/manual-work" }]),
				stderr: "",
			};
		},
	};

	const result = await ensureWorktree(pi, "ladislas/feature/manual-work");

	assert.deepEqual(result, {
		ok: true,
		value: { created: false, path: "/repo/.worktrees/manual-work" },
	});
	assert.deepEqual(calls, [["wt", ["list", "--format=json"]]]);
});

test("reports an existing Worktrunk entry without a path before trying to create", async () => {
	const calls = [];
	const pi = {
		async exec(command, args) {
			calls.push([command, args]);
			assert.deepEqual([command, args], ["wt", ["list", "--format=json"]]);
			return {
				code: 0,
				stdout: JSON.stringify([{ branch: "ladislas/feature/85-work" }]),
				stderr: "",
			};
		},
	};

	const result = await ensureWorktree(pi, "ladislas/feature/85-work");

	assert.deepEqual(result, {
		ok: false,
		error: "Worktree for ladislas/feature/85-work exists but has no path in wt list output.",
	});
	assert.equal(calls.length, 1);
});

test("formats a single-line recovery command without submitting a prompt", () => {
	assert.equal(
		formatIssueWorktreeSummary({
			created: true,
			issueNumber: 85,
			issueTitle: "Adopt Worktrunk",
			branch: "ladislas/feature/85-adopt-worktrunk",
			path: "/tmp/my worktree",
		}),
		[
			"Created worktree for #85: Adopt Worktrunk",
			"Branch: ladislas/feature/85-adopt-worktrunk",
			"Path: /tmp/my worktree",
			"",
			"Open Pi:",
			"wt switch ladislas/feature/85-adopt-worktrunk -x pi",
		].join("\n"),
	);
});
