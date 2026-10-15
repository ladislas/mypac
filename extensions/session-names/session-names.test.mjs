import test from "node:test";
import assert from "node:assert/strict";
import {
	buildWorkflowSessionName,
	extractSlashCommandArgument,
	normalizeSessionNameSuffix,
} from "./helpers.ts";

test("normalizeSessionNameSuffix collapses whitespace and strips wrapping quotes", () => {
	assert.equal(normalizeSessionNameSuffix('  "fix   README   install steps"  '), "fix README install steps");
});

test("normalizeSessionNameSuffix shortens GitHub issue and PR URLs", () => {
	assert.equal(
		normalizeSessionNameSuffix("https://github.com/ladislas/mypac/issues/126"),
		"issue #126",
	);
	assert.equal(
		normalizeSessionNameSuffix("https://github.com/ladislas/mypac/pull/456/files"),
		"PR #456",
	);
});

test("workflow session names prefer leading GitHub targets over multiline context", () => {
	const lwotInput = extractSlashCommandArgument(
		`/pac-lwot "\nhttps://github.com/ladislas/mypac/issues/368\nadditional context here\n"`,
		"pac-lwot",
	);
	assert.notEqual(lwotInput, null);
	assert.equal(buildWorkflowSessionName("lwot", lwotInput), "lwot - issue #368");

	const llatInput = extractSlashCommandArgument(
		`/pac-llat "\nhttps://github.com/ladislas/mypac/pull/404\nadditional context here\n"`,
		"pac-llat",
	);
	assert.notEqual(llatInput, null);
	assert.equal(buildWorkflowSessionName("llat", llatInput), "llat - PR #404");
});

test("normalizeSessionNameSuffix trims generic URLs", () => {
	assert.equal(normalizeSessionNameSuffix("https://example.com/spec-notes/?view=full"), "example.com/spec-notes");
});

test("normalizeSessionNameSuffix truncates long input", () => {
	assert.equal(normalizeSessionNameSuffix("a".repeat(70), 12), "aaaaaaaaa...");
});

test("buildWorkflowSessionName returns undefined without usable input", () => {
	assert.equal(buildWorkflowSessionName("lwot", "   "), undefined);
	assert.equal(buildWorkflowSessionName("   ", "target"), undefined);
});

test("buildWorkflowSessionName prefixes normalized input", () => {
	assert.equal(buildWorkflowSessionName("lwot", "  fix README install steps  "), "lwot - fix README install steps");
	assert.equal(buildWorkflowSessionName("llat", "  issue #295  "), "llat - issue #295");
});

test("extractSlashCommandArgument finds pac-lwot input", () => {
	assert.equal(extractSlashCommandArgument("/pac-lwot fix the README", "pac-lwot"), "fix the README");
	assert.equal(
		extractSlashCommandArgument("/pac-lwot   https://github.com/ladislas/mypac/issues/126  ", "pac-lwot"),
		"https://github.com/ladislas/mypac/issues/126",
	);
	assert.equal(extractSlashCommandArgument("/pac-lwot", "pac-lwot"), "");
	assert.equal(extractSlashCommandArgument("/ghi fix README", "pac-lwot"), null);
});
