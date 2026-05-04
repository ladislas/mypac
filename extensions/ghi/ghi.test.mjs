import test from "node:test";
import assert from "node:assert/strict";
import { buildIssueCreatePrompt, buildIssueSessionName, normalizeIssueNote } from "./helpers.ts";

test("normalizeIssueNote trims surrounding whitespace", () => {
	assert.equal(normalizeIssueNote("  fix README install steps  \n"), "fix README install steps");
});

test("buildIssueCreatePrompt keeps the issue note at the end", () => {
	const prompt = buildIssueCreatePrompt("Skill instructions", "Need a better /ghi MVP");
	assert.ok(prompt.startsWith("Skill instructions\n\n---\n\nCreate a GitHub issue"));
	assert.ok(prompt.endsWith("Issue note:\nNeed a better /ghi MVP"));
});

test("buildIssueSessionName prefixes normalized note", () => {
	assert.equal(buildIssueSessionName("  Need a better /ghi MVP  "), "ghi - Need a better /ghi MVP");
});
