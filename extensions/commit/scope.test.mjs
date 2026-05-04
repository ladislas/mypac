import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildCommitPrompt, buildScopedFiles, parseChangedFiles, parseCommitArgs } from "./scope.ts";

test("parseCommitArgs separates include, exclude, and hint tokens", async () => {
	const cwd = await mkdtemp(path.join(tmpdir(), "commit-scope-"));
	await mkdir(path.join(cwd, "docs"), { recursive: true });
	await writeFile(path.join(cwd, "docs", "note.md"), "hello", "utf8");

	const options = parseCommitArgs('--include README.md -e prompts "docs/note.md" keep history tidy', cwd);

	assert.deepEqual(options.includes, ["README.md", "docs/note.md"]);
	assert.deepEqual(options.excludes, ["prompts"]);
	assert.equal(options.hint, "keep history tidy");
});

test("parseChangedFiles keeps renamed targets and normalizes slashes", () => {
	const files = parseChangedFiles([" M prompts/pac-lwot.md", "R  old\\name.md -> new\\name.md"].join("\n"));

	assert.deepEqual(files, ["prompts/pac-lwot.md", "new/name.md"]);
});

test("buildScopedFiles applies include and exclude scopes", () => {
	const scoped = buildScopedFiles(
		["README.md", "prompts/pac-lwot.md", "prompts/pac-ldit.md", "skills/pac-pi-prompt/SKILL.md"],
		{
			includes: ["prompts"],
			excludes: ["prompts/pac-ldit.md"],
			hint: "",
		},
	);

	assert.deepEqual(scoped, ["prompts/pac-lwot.md"]);
});

test("buildCommitPrompt includes skill content and scoped files", () => {
	const prompt = buildCommitPrompt({
		scopedFiles: ["prompts/pac-lwot.md", "prompts/pac-ldit.md"],
		includes: ["prompts"],
		excludes: ["prompts/pac-ldit.md"],
		hint: "docs-only follow-up",
		skillContent: "# Commit skill\n\nUse gitmoji.",
	});

	assert.ok(prompt.startsWith("# Commit skill\n\nUse gitmoji.\n\n---"));
	assert.match(prompt, /Scoped changed files:\n- prompts\/pac-lwot\.md\n- prompts\/pac-ldit\.md/);
	assert.match(prompt, /Requested include scopes:\n- prompts/);
	assert.match(prompt, /Requested exclude scopes:\n- prompts\/pac-ldit\.md/);
	assert.match(prompt, /Hint from user: docs-only follow-up/);
});
