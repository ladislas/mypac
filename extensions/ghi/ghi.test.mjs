import test from "node:test";
import assert from "node:assert/strict";
import { buildIssueCreatePrompt, buildIssueSessionName, loadIssueCreateSkill, normalizeIssueNote } from "./helpers.ts";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

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

test("loadIssueCreateSkill returns trimmed file content", async () => {
	const dir = await mkdtemp(path.join(tmpdir(), "ghi-skill-"));
	const skillPath = path.join(dir, "SKILL.md");
	await writeFile(skillPath, "\n  Example skill content\n\n", "utf8");

	assert.equal(await loadIssueCreateSkill(skillPath), "Example skill content");
});

test("loadIssueCreateSkill returns null when the file is missing", async () => {
	const dir = await mkdtemp(path.join(tmpdir(), "ghi-skill-missing-"));
	const skillPath = path.join(dir, "missing.md");

	assert.equal(await loadIssueCreateSkill(skillPath), null);
});
