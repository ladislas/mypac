import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	loadMarkdownReviewPrompt,
	loadReviewSummaryPrompt,
	ReviewPromptLoadError,
	stripPromptMarkdownTitle,
} from "./prompts.ts";

test("stripPromptMarkdownTitle removes a single Markdown title", () => {
	assert.equal(stripPromptMarkdownTitle("# Prompt Title\n\nBody"), "Body");
});

test("loadMarkdownReviewPrompt returns stripped prompt content", async () => {
	const dir = await mkdtemp(path.join(tmpdir(), "review-prompts-"));
	try {
		const promptPath = path.join(dir, "PROMPT.md");
		await writeFile(promptPath, "# Test Prompt\n\nPrompt body\n", "utf8");

		assert.equal(await loadMarkdownReviewPrompt("test", promptPath), "Prompt body");
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("loadMarkdownReviewPrompt reports missing Markdown prompt files clearly", async () => {
	const missingPath = path.join(tmpdir(), "missing-review-prompt.md");

	await assert.rejects(
		() => loadMarkdownReviewPrompt("test", missingPath),
		(error) => {
			assert.ok(error instanceof ReviewPromptLoadError);
			assert.match(error.message, /Review extension failed to load test Markdown prompt/);
			assert.match(error.message, /missing-review-prompt\.md/);
			return true;
		},
	);
});

test("loadReviewSummaryPrompt preserves the canonical template body", async () => {
	const source = await readFile(new URL("./REVIEW_SUMMARY_PROMPT.md", import.meta.url), "utf8");
	assert.ok(source.trim().length > 0);
	assert.equal(await loadReviewSummaryPrompt(), stripPromptMarkdownTitle(source));
});
