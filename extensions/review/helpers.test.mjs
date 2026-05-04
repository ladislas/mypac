import test from "node:test";
import assert from "node:assert/strict";
import {
	buildReviewFixFindingsPrompt,
	buildReviewSessionName,
	hasNeedsAttentionVerdict,
	parseArgs,
} from "./helpers.ts";

// ─── hasNeedsAttentionVerdict ─────────────────────────────────────────────────

test("hasNeedsAttentionVerdict: detects inline verdict", () => {
	assert.equal(hasNeedsAttentionVerdict("Verdict: needs attention"), true);
	assert.equal(hasNeedsAttentionVerdict("Overall Verdict: Needs Attention"), true);
});

test("hasNeedsAttentionVerdict: detects block verdict under heading", () => {
	assert.equal(hasNeedsAttentionVerdict("## Verdict\n\nneeds attention"), true);
});

test("hasNeedsAttentionVerdict: returns false for correct verdict", () => {
	assert.equal(hasNeedsAttentionVerdict("Verdict: correct"), false);
	assert.equal(hasNeedsAttentionVerdict("## Verdict\n\ncorrect"), false);
});

test("hasNeedsAttentionVerdict: rejects rubric choice phrasing", () => {
	assert.equal(hasNeedsAttentionVerdict("Verdict: correct or needs attention"), false);
});

// ─── parseArgs ────────────────────────────────────────────────────────────────

test("parseArgs: empty → null target", () => {
	assert.deepEqual(parseArgs(undefined), { target: null });
	assert.deepEqual(parseArgs(""), { target: null });
});

test("parseArgs: uncommitted", () => {
	assert.deepEqual(parseArgs("uncommitted"), { target: { type: "uncommitted" } });
});

test("parseArgs: branch", () => {
	assert.deepEqual(parseArgs("branch main"), { target: { type: "baseBranch", branch: "main" } });
});

test("parseArgs: branch without name → null", () => {
	assert.deepEqual(parseArgs("branch"), { target: null });
});

test("parseArgs: commit with sha", () => {
	assert.deepEqual(parseArgs("commit abc1234"), { target: { type: "commit", sha: "abc1234" } });
});

test("parseArgs: commit with sha and title", () => {
	assert.deepEqual(parseArgs("commit abc1234 Fix the bug"), {
		target: { type: "commit", sha: "abc1234", title: "Fix the bug" },
	});
});

test("parseArgs: folder", () => {
	assert.deepEqual(parseArgs("folder src docs"), { target: { type: "folder", paths: ["src", "docs"] } });
});

test("parseArgs: pr with number", () => {
	assert.deepEqual(parseArgs("pr 123"), { target: { type: "pr", ref: "123" } });
});

test("parseArgs: --extra flag", () => {
	assert.deepEqual(parseArgs("uncommitted --extra 'focus on perf'"), {
		target: { type: "uncommitted" },
		extraInstruction: "focus on perf",
	});
});

test("parseArgs: --extra without value → error", () => {
	assert.equal(parseArgs("--extra").error, "Missing value for --extra");
});

test("parseArgs: unknown subcommand → null target", () => {
	assert.deepEqual(parseArgs("invalid"), { target: null });
});

test("buildReviewSessionName: branch target uses branch name", () => {
	assert.equal(buildReviewSessionName({ type: "baseBranch", branch: "feature/foo" }), "review - feature/foo");
});

test("buildReviewSessionName: PR target includes number and title", () => {
	assert.equal(
		buildReviewSessionName({ type: "pullRequest", prNumber: 126, baseBranch: "main", title: "Set session display names" }),
		"review - PR #126: Set session display names",
	);
});

test("buildReviewSessionName: uncommitted target uses literal label", () => {
	assert.equal(buildReviewSessionName({ type: "uncommitted" }), "review - uncommitted");
});

test("buildReviewFixFindingsPrompt: uncommitted reviews use staging workflow", () => {
	const prompt = buildReviewFixFindingsPrompt("uncommitted");
	assert.match(prompt, /started in uncommitted changes mode/i);
	assert.match(prompt, /\*\*Staging workflow:\*\*/);
	assert.doesNotMatch(prompt, /git log --oneline/);
	assert.doesNotMatch(prompt, /\*\*Fixup workflow:\*\*/);
	assert.match(prompt, /Review or commit the staged\/unstaged changes manually/);
});

test("buildReviewFixFindingsPrompt: base-branch reviews use fixup workflow", () => {
	const prompt = buildReviewFixFindingsPrompt("baseBranch");
	assert.match(prompt, /started in base branch mode/i);
	assert.match(prompt, /\*\*Fixup workflow:\*\*/);
	assert.match(prompt, /git commit --fixup <sha>/);
	assert.match(prompt, /git rebase --autosquash/);
	assert.doesNotMatch(prompt, /\*\*Staging workflow:\*\*/);
});

test("buildReviewFixFindingsPrompt: unknown review mode defaults to staging workflow", () => {
	const prompt = buildReviewFixFindingsPrompt();
	assert.match(prompt, /original review mode is unavailable/i);
	assert.match(prompt, /\*\*Staging workflow:\*\*/);
	assert.doesNotMatch(prompt, /\*\*Fixup workflow:\*\*/);
});
