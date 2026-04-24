import test from "node:test";
import assert from "node:assert/strict";
import {
	parseMarkdownHeading,
	getFindingsSectionBounds,
	isLikelyFindingLine,
	normalizeVerdictValue,
	isNeedsAttentionVerdictValue,
	hasNeedsAttentionVerdict,
	hasBlockingReviewFindings,
	parsePrReference,
	parseReviewPaths,
	tokenizeArgs,
	parseArgs,
	getUserFacingHint,
} from "./helpers.ts";

// ─── parseMarkdownHeading ─────────────────────────────────────────────────────

test("parseMarkdownHeading: parses h1 through h6", () => {
	assert.deepEqual(parseMarkdownHeading("# Title"), { level: 1, title: "Title" });
	assert.deepEqual(parseMarkdownHeading("## Title"), { level: 2, title: "Title" });
	assert.deepEqual(parseMarkdownHeading("###### Deep"), { level: 6, title: "Deep" });
});

test("parseMarkdownHeading: returns null for non-headings", () => {
	assert.equal(parseMarkdownHeading("regular text"), null);
	assert.equal(parseMarkdownHeading(""), null);
	assert.equal(parseMarkdownHeading("#no-space"), null);
});

test("parseMarkdownHeading: strips trailing hashes", () => {
	assert.deepEqual(parseMarkdownHeading("## Title ##"), { level: 2, title: "Title" });
});

// ─── isLikelyFindingLine ──────────────────────────────────────────────────────

test("isLikelyFindingLine: accepts bullet with priority tag", () => {
	assert.equal(isLikelyFindingLine("- [P0] Critical issue"), true);
	assert.equal(isLikelyFindingLine("- [P1] Important issue"), true);
	assert.equal(isLikelyFindingLine("* [P2] Normal issue"), true);
	assert.equal(isLikelyFindingLine("1. [P3] Nice to have"), true);
});

test("isLikelyFindingLine: accepts heading with priority tag", () => {
	assert.equal(isLikelyFindingLine("## [P0] Critical heading"), true);
	assert.equal(isLikelyFindingLine("### [P2] Something"), true);
});

test("isLikelyFindingLine: rejects lines without priority tags", () => {
	assert.equal(isLikelyFindingLine("- regular finding"), false);
	assert.equal(isLikelyFindingLine("some text"), false);
});

test("isLikelyFindingLine: rejects rubric/legend lines describing priority tags", () => {
	assert.equal(isLikelyFindingLine("- [P0] - Drop everything to fix"), false);
	assert.equal(isLikelyFindingLine("- [P3] - Low. Nice to have."), false);
	assert.equal(isLikelyFindingLine("- Priority Tag [P0]"), false);
});

test("isLikelyFindingLine: rejects lines with multiple priority tags", () => {
	assert.equal(isLikelyFindingLine("- [P0] or [P1] issue"), false);
});

// ─── normalizeVerdictValue ────────────────────────────────────────────────────

test("normalizeVerdictValue: lowercases and strips punctuation", () => {
	assert.equal(normalizeVerdictValue("Needs Attention"), "needs attention");
	assert.equal(normalizeVerdictValue("- needs attention"), "needs attention");
	assert.equal(normalizeVerdictValue('"correct"'), "correct");
	assert.equal(normalizeVerdictValue("  Correct  "), "correct");
});

// ─── isNeedsAttentionVerdictValue ─────────────────────────────────────────────

test("isNeedsAttentionVerdictValue: detects needs attention", () => {
	assert.equal(isNeedsAttentionVerdictValue("needs attention"), true);
	assert.equal(isNeedsAttentionVerdictValue("Needs Attention"), true);
	assert.equal(isNeedsAttentionVerdictValue("- Needs Attention"), true);
});

test("isNeedsAttentionVerdictValue: rejects correct verdict", () => {
	assert.equal(isNeedsAttentionVerdictValue("correct"), false);
	assert.equal(isNeedsAttentionVerdictValue("Correct"), false);
});

test("isNeedsAttentionVerdictValue: rejects rubric choice phrasing", () => {
	assert.equal(isNeedsAttentionVerdictValue("correct or needs attention"), false);
});

test("isNeedsAttentionVerdictValue: rejects negated form", () => {
	assert.equal(isNeedsAttentionVerdictValue("not needs attention"), false);
});

// ─── hasNeedsAttentionVerdict ─────────────────────────────────────────────────

test("hasNeedsAttentionVerdict: detects inline verdict", () => {
	assert.equal(hasNeedsAttentionVerdict("Verdict: needs attention"), true);
	assert.equal(hasNeedsAttentionVerdict("Overall Verdict: Needs Attention"), true);
});

test("hasNeedsAttentionVerdict: detects block verdict under heading", () => {
	const text = `## Verdict\n\nneeds attention`;
	assert.equal(hasNeedsAttentionVerdict(text), true);
});

test("hasNeedsAttentionVerdict: returns false for correct verdict", () => {
	assert.equal(hasNeedsAttentionVerdict("Verdict: correct"), false);
	assert.equal(hasNeedsAttentionVerdict("## Verdict\n\ncorrect"), false);
});

test("hasNeedsAttentionVerdict: rejects rubric choice phrasing", () => {
	assert.equal(hasNeedsAttentionVerdict("Verdict: correct or needs attention"), false);
});

// ─── hasBlockingReviewFindings ────────────────────────────────────────────────

test("hasBlockingReviewFindings: empty text → false", () => {
	assert.equal(hasBlockingReviewFindings(""), false);
});

test("hasBlockingReviewFindings: P0 finding → true", () => {
	const text = `## Findings\n\n- [P0] Critical security bug\n\n## Verdict\ncorrect`;
	assert.equal(hasBlockingReviewFindings(text), true);
});

test("hasBlockingReviewFindings: P1 finding → true", () => {
	const text = `## Findings\n\n- [P1] Important issue\n\n## Verdict\ncorrect`;
	assert.equal(hasBlockingReviewFindings(text), true);
});

test("hasBlockingReviewFindings: P2 finding → true", () => {
	const text = `## Findings\n\n- [P2] Normal issue\n\n## Verdict\ncorrect`;
	assert.equal(hasBlockingReviewFindings(text), true);
});

test("hasBlockingReviewFindings: P3 only → false", () => {
	const text = `## Findings\n\n- [P3] Nice to have\n\n## Verdict\ncorrect`;
	assert.equal(hasBlockingReviewFindings(text), false);
});

test("hasBlockingReviewFindings: P3 + needs-attention verdict → false (tagged finding short-circuits verdict)", () => {
	const text = `## Findings\n\n- [P3] Nice to have\n\n## Verdict\nneeds attention`;
	assert.equal(hasBlockingReviewFindings(text), false);
});

test("hasBlockingReviewFindings: no tagged findings + needs-attention verdict → true", () => {
	const text = `## Verdict\nneeds attention`;
	assert.equal(hasBlockingReviewFindings(text), true);
});

test("hasBlockingReviewFindings: no tagged findings + correct verdict → false", () => {
	const text = `## Verdict\ncorrect`;
	assert.equal(hasBlockingReviewFindings(text), false);
});

test("hasBlockingReviewFindings: P2 inside code fence is ignored", () => {
	const text = [
		"## Findings",
		"",
		"No issues found.",
		"",
		"```",
		"- [P2] this is example code, not a finding",
		"```",
		"",
		"## Verdict",
		"correct",
	].join("\n");
	assert.equal(hasBlockingReviewFindings(text), false);
});

test("hasBlockingReviewFindings: priority rubric legend lines not counted as findings", () => {
	const text = [
		"## Priority levels",
		"- [P0] - Drop everything to fix.",
		"- [P1] - Urgent.",
		"- [P2] - Normal.",
		"- [P3] - Low.",
		"",
		"## Verdict",
		"correct",
	].join("\n");
	assert.equal(hasBlockingReviewFindings(text), false);
});

test("hasBlockingReviewFindings: findings stop at Verdict heading", () => {
	// P2 appears after the Verdict heading, outside Findings — should not be counted
	const text = [
		"## Findings",
		"",
		"No issues in scope.",
		"",
		"## Verdict",
		"correct",
		"",
		"See also [P2] in old code (pre-existing, not in diff).",
	].join("\n");
	assert.equal(hasBlockingReviewFindings(text), false);
});

// ─── parsePrReference ─────────────────────────────────────────────────────────

test("parsePrReference: plain number", () => {
	assert.equal(parsePrReference("123"), 123);
	assert.equal(parsePrReference("  42  "), 42);
});

test("parsePrReference: GitHub PR URL", () => {
	assert.equal(parsePrReference("https://github.com/owner/repo/pull/456"), 456);
	assert.equal(parsePrReference("github.com/owner/repo/pull/789"), 789);
});

test("parsePrReference: invalid input → null", () => {
	assert.equal(parsePrReference("not-a-number"), null);
	assert.equal(parsePrReference(""), null);
	assert.equal(parsePrReference("0"), null);
	assert.equal(parsePrReference("-1"), null);
});

// ─── parseReviewPaths ─────────────────────────────────────────────────────────

test("parseReviewPaths: splits on whitespace", () => {
	assert.deepEqual(parseReviewPaths("src docs"), ["src", "docs"]);
	assert.deepEqual(parseReviewPaths("  a  b  c  "), ["a", "b", "c"]);
});

test("parseReviewPaths: single path", () => {
	assert.deepEqual(parseReviewPaths("src"), ["src"]);
});

test("parseReviewPaths: empty string → empty array", () => {
	assert.deepEqual(parseReviewPaths(""), []);
	assert.deepEqual(parseReviewPaths("   "), []);
});

// ─── tokenizeArgs ─────────────────────────────────────────────────────────────

test("tokenizeArgs: basic split", () => {
	assert.deepEqual(tokenizeArgs("a b c"), ["a", "b", "c"]);
});

test("tokenizeArgs: double-quoted string", () => {
	assert.deepEqual(tokenizeArgs('a "b c" d'), ["a", "b c", "d"]);
});

test("tokenizeArgs: single-quoted string", () => {
	assert.deepEqual(tokenizeArgs("a 'b c' d"), ["a", "b c", "d"]);
});

test("tokenizeArgs: escaped quote inside quoted string", () => {
	assert.deepEqual(tokenizeArgs('"say \\"hi\\""'), ['say "hi"']);
});

test("tokenizeArgs: empty string", () => {
	assert.deepEqual(tokenizeArgs(""), []);
});

// ─── parseArgs ────────────────────────────────────────────────────────────────

test("parseArgs: empty → null target", () => {
	assert.deepEqual(parseArgs(undefined), { target: null });
	assert.deepEqual(parseArgs(""), { target: null });
	assert.deepEqual(parseArgs("  "), { target: null });
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

test("parseArgs: commit without sha → null", () => {
	assert.deepEqual(parseArgs("commit"), { target: null });
});

test("parseArgs: folder", () => {
	assert.deepEqual(parseArgs("folder src docs"), { target: { type: "folder", paths: ["src", "docs"] } });
});

test("parseArgs: pr with number", () => {
	assert.deepEqual(parseArgs("pr 123"), { target: { type: "pr", ref: "123" } });
});

test("parseArgs: pr with URL", () => {
	assert.deepEqual(parseArgs("pr https://github.com/owner/repo/pull/456"), {
		target: { type: "pr", ref: "https://github.com/owner/repo/pull/456" },
	});
});

test("parseArgs: --extra flag", () => {
	assert.deepEqual(parseArgs("uncommitted --extra 'focus on perf'"), {
		target: { type: "uncommitted" },
		extraInstruction: "focus on perf",
	});
});

test("parseArgs: --extra= inline form", () => {
	assert.deepEqual(parseArgs("uncommitted --extra=perf"), {
		target: { type: "uncommitted" },
		extraInstruction: "perf",
	});
});

test("parseArgs: --extra without value → error", () => {
	const result = parseArgs("--extra");
	assert.equal(result.error, "Missing value for --extra");
});

test("parseArgs: unknown subcommand → null target", () => {
	assert.deepEqual(parseArgs("invalid"), { target: null });
});

// ─── getUserFacingHint ────────────────────────────────────────────────────────

test("getUserFacingHint: uncommitted", () => {
	assert.equal(getUserFacingHint({ type: "uncommitted" }), "current changes");
});

test("getUserFacingHint: baseBranch", () => {
	assert.equal(getUserFacingHint({ type: "baseBranch", branch: "main" }), "changes against 'main'");
});

test("getUserFacingHint: commit with title", () => {
	assert.equal(
		getUserFacingHint({ type: "commit", sha: "abc1234def", title: "Fix bug" }),
		"commit abc1234: Fix bug",
	);
});

test("getUserFacingHint: commit without title", () => {
	assert.equal(getUserFacingHint({ type: "commit", sha: "abc1234def" }), "commit abc1234");
});

test("getUserFacingHint: pullRequest short title", () => {
	assert.equal(
		getUserFacingHint({ type: "pullRequest", prNumber: 42, baseBranch: "main", title: "Add feature" }),
		"PR #42: Add feature",
	);
});

test("getUserFacingHint: pullRequest long title is truncated", () => {
	const hint = getUserFacingHint({
		type: "pullRequest",
		prNumber: 1,
		baseBranch: "main",
		title: "A very long pull request title that exceeds thirty chars",
	});
	assert.ok(hint.startsWith("PR #1: "));
	assert.ok(hint.endsWith("..."));
});

test("getUserFacingHint: folder short paths", () => {
	assert.equal(getUserFacingHint({ type: "folder", paths: ["src", "docs"] }), "folders: src, docs");
});

test("getUserFacingHint: folder long paths are truncated", () => {
	const hint = getUserFacingHint({
		type: "folder",
		paths: ["very/long/path/one", "very/long/path/two", "very/long/path/three"],
	});
	assert.ok(hint.startsWith("folders: "));
	assert.ok(hint.endsWith("..."));
});
