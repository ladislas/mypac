import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadSkillFromPath, loadPackageSkill, parseSkillContent } from "./skill-loader.ts";

// ─── parseSkillContent ────────────────────────────────────────────────────────

test("parseSkillContent: strips frontmatter and returns content separately", () => {
	const raw = `---
name: example
description: A test skill
---

# Instructions

Do something.`;
	const result = parseSkillContent(raw);
	assert.equal(result.frontmatter, "name: example\ndescription: A test skill");
	assert.equal(result.content, "# Instructions\n\nDo something.");
});

test("parseSkillContent: no frontmatter returns full text as content", () => {
	const raw = "# Instructions\n\nDo something.";
	const result = parseSkillContent(raw);
	assert.equal(result.frontmatter, "");
	assert.equal(result.content, "# Instructions\n\nDo something.");
});

test("parseSkillContent: unclosed frontmatter delimiter treated as no frontmatter", () => {
	const raw = "---\nname: broken\n# Instructions";
	const result = parseSkillContent(raw);
	assert.equal(result.frontmatter, "");
	assert.ok(result.content.startsWith("---"));
});

// ─── loadSkillFromPath ────────────────────────────────────────────────────────

test("loadSkillFromPath: loads a valid skill and strips frontmatter", async () => {
	const dir = await mkdtemp(path.join(tmpdir(), "skill-loader-"));
	const filePath = path.join(dir, "SKILL.md");
	await writeFile(
		filePath,
		`---
name: pac-test
---

# Test skill

Instructions here.`,
		"utf8",
	);

	const result = await loadSkillFromPath(filePath);
	assert.ok(result !== null);
	assert.equal(result.frontmatter, "name: pac-test");
	assert.equal(result.content, "# Test skill\n\nInstructions here.");
});

test("loadSkillFromPath: returns null when the file is missing", async () => {
	const dir = await mkdtemp(path.join(tmpdir(), "skill-loader-missing-"));
	const filePath = path.join(dir, "SKILL.md");
	assert.equal(await loadSkillFromPath(filePath), null);
});

test("loadSkillFromPath: returns null for an empty file", async () => {
	const dir = await mkdtemp(path.join(tmpdir(), "skill-loader-empty-"));
	const filePath = path.join(dir, "SKILL.md");
	await writeFile(filePath, "   \n\n   ", "utf8");
	assert.equal(await loadSkillFromPath(filePath), null);
});

test("loadSkillFromPath: exposes raw frontmatter and stripped content separately", async () => {
	const dir = await mkdtemp(path.join(tmpdir(), "skill-loader-fm-"));
	const filePath = path.join(dir, "SKILL.md");
	await writeFile(filePath, "---\nlicense: MIT\n---\n\n# Body\n", "utf8");

	const result = await loadSkillFromPath(filePath);
	assert.ok(result !== null);
	assert.equal(result.frontmatter, "license: MIT");
	assert.equal(result.content, "# Body");
});

// ─── loadPackageSkill ─────────────────────────────────────────────────────────

test("loadPackageSkill: loads a real package skill by name", async () => {
	const result = await loadPackageSkill("pac-review");
	assert.ok(result !== null, "pac-review skill should be loadable");
	assert.ok(result.content.length > 0, "skill content should be non-empty");
	assert.ok(result.frontmatter.includes("pac-review"), "frontmatter should contain skill name");
});

test("loadPackageSkill: returns null for a non-existent skill name", async () => {
	const result = await loadPackageSkill("pac-does-not-exist");
	assert.equal(result, null);
});
