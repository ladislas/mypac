import test from "node:test";
import assert from "node:assert/strict";
import { parsePatch, deriveUpdatedContent, seekSequence, normalizeToLF, ensureTrailingNewline } from "./patch.ts";
import { generateDiffString } from "./diff.ts";
import { applyClassicEdits } from "./classic.ts";
import { createVirtualWorkspace } from "./workspace.ts";

// --- normalizeToLF ---

test("normalizeToLF converts CRLF to LF", () => {
	assert.equal(normalizeToLF("a\r\nb\r\nc"), "a\nb\nc");
});

test("normalizeToLF converts bare CR to LF", () => {
	assert.equal(normalizeToLF("a\rb"), "a\nb");
});

// --- ensureTrailingNewline ---

test("ensureTrailingNewline adds newline when missing", () => {
	assert.equal(ensureTrailingNewline("hello"), "hello\n");
});

test("ensureTrailingNewline does not double newline", () => {
	assert.equal(ensureTrailingNewline("hello\n"), "hello\n");
});

// --- seekSequence ---

test("seekSequence finds a pattern at the start", () => {
	assert.equal(seekSequence(["a", "b", "c"], ["a", "b"], 0, false), 0);
});

test("seekSequence finds a pattern mid-array", () => {
	assert.equal(seekSequence(["a", "b", "c", "d"], ["c", "d"], 0, false), 2);
});

test("seekSequence returns undefined when pattern not found", () => {
	assert.equal(seekSequence(["a", "b"], ["x"], 0, false), undefined);
});

test("seekSequence with eof=true searches from the end", () => {
	// Pattern appears twice; eof=true should find the last occurrence
	const result = seekSequence(["a", "b", "a", "b"], ["a", "b"], 0, true);
	assert.equal(result, 2);
});

test("seekSequence returns start when pattern is empty", () => {
	assert.equal(seekSequence(["a", "b"], [], 1, false), 1);
});

// --- parsePatch ---

test("parsePatch rejects missing Begin Patch header", () => {
	assert.throws(() => parsePatch("wrong header\n*** End Patch"), /first line/);
});

test("parsePatch rejects missing End Patch footer", () => {
	assert.throws(() => parsePatch("*** Begin Patch\n*** Update File: foo.ts"), /last line/);
});

test("parsePatch parses an Add File operation", () => {
	const patch = [
		"*** Begin Patch",
		"*** Add File: hello.txt",
		"+Hello world",
		"*** End Patch",
	].join("\n");
	const ops = parsePatch(patch);
	assert.equal(ops.length, 1);
	assert.equal(ops[0].kind, "add");
	assert.equal(ops[0].path, "hello.txt");
	if (ops[0].kind === "add") {
		assert.equal(ops[0].contents, "Hello world\n");
	}
});

test("parsePatch parses a Delete File operation", () => {
	const patch = ["*** Begin Patch", "*** Delete File: old.txt", "*** End Patch"].join("\n");
	const ops = parsePatch(patch);
	assert.equal(ops.length, 1);
	assert.equal(ops[0].kind, "delete");
	assert.equal(ops[0].path, "old.txt");
});

test("parsePatch parses an Update File operation", () => {
	const patch = [
		"*** Begin Patch",
		"*** Update File: foo.ts",
		"@@ context line",
		" unchanged",
		"-old line",
		"+new line",
		"*** End Patch",
	].join("\n");
	const ops = parsePatch(patch);
	assert.equal(ops.length, 1);
	assert.equal(ops[0].kind, "update");
	assert.equal(ops[0].path, "foo.ts");
});

test("parsePatch rejects move operations", () => {
	const patch = [
		"*** Begin Patch",
		"*** Update File: foo.ts",
		"*** Move to: bar.ts",
		"*** End Patch",
	].join("\n");
	assert.throws(() => parsePatch(patch), /move operations/i);
});

// --- deriveUpdatedContent ---

test("deriveUpdatedContent replaces a line", () => {
	const content = "line1\nline2\nline3\n";
	const result = deriveUpdatedContent("f.ts", content, [
		{ oldLines: ["line2"], newLines: ["replaced"], isEndOfFile: false },
	]);
	assert.equal(result, "line1\nreplaced\nline3\n");
});

test("deriveUpdatedContent deletes a line", () => {
	const content = "a\nb\nc\n";
	const result = deriveUpdatedContent("f.ts", content, [
		{ oldLines: ["b"], newLines: [], isEndOfFile: false },
	]);
	assert.equal(result, "a\nc\n");
});

test("deriveUpdatedContent inserts at end of file", () => {
	const content = "a\nb\n";
	const result = deriveUpdatedContent("f.ts", content, [
		{ oldLines: [], newLines: ["c"], isEndOfFile: true },
	]);
	assert.equal(result, "a\nb\nc\n");
});

test("deriveUpdatedContent throws when old lines not found", () => {
	assert.throws(
		() => deriveUpdatedContent("f.ts", "a\nb\n", [{ oldLines: ["x"], newLines: ["y"], isEndOfFile: false }]),
		/Failed to find expected lines/,
	);
});

// --- generateDiffString ---

test("generateDiffString produces + lines for additions", () => {
	const { diff } = generateDiffString("", "hello\n");
	assert.ok(diff.includes("+"));
});

test("generateDiffString produces - lines for deletions", () => {
	const { diff } = generateDiffString("hello\n", "");
	assert.ok(diff.includes("-"));
});

test("generateDiffString reports firstChangedLine", () => {
	const { firstChangedLine } = generateDiffString("a\nb\n", "a\nc\n");
	assert.equal(firstChangedLine, 2);
});

test("generateDiffString returns empty diff and undefined firstChangedLine for identical content", () => {
	const { diff, firstChangedLine } = generateDiffString("same\n", "same\n");
	assert.equal(diff, "");
	assert.equal(firstChangedLine, undefined);
});

// --- applyClassicEdits (via virtual workspace) ---

test("applyClassicEdits applies a single edit", async () => {
	const cwd = "/fake";
	const ws = createVirtualWorkspace(cwd);
	await ws.writeText("/fake/file.ts", "const x = 1;\nconst y = 2;\n");

	const results = await applyClassicEdits(
		[{ path: "file.ts", oldText: "const x = 1;", newText: "const x = 42;" }],
		ws,
		cwd,
	);

	assert.equal(results.length, 1);
	assert.equal(results[0].success, true);
	const updated = await ws.readText("/fake/file.ts");
	assert.ok(updated.includes("const x = 42;"));
});

test("applyClassicEdits throws when oldText not found", async () => {
	const cwd = "/fake";
	const ws = createVirtualWorkspace(cwd);
	await ws.writeText("/fake/file.ts", "const x = 1;\n");

	await assert.rejects(
		() => applyClassicEdits([{ path: "file.ts", oldText: "not present", newText: "y" }], ws, cwd),
		/Could not find/,
	);
});

test("applyClassicEdits applies multiple edits in order", async () => {
	const cwd = "/fake";
	const ws = createVirtualWorkspace(cwd);
	await ws.writeText("/fake/file.ts", "a\nb\nc\n");

	await applyClassicEdits(
		[
			{ path: "file.ts", oldText: "a", newText: "A" },
			{ path: "file.ts", oldText: "c", newText: "C" },
		],
		ws,
		cwd,
	);

	const result = await ws.readText("/fake/file.ts");
	assert.ok(result.includes("A"));
	assert.ok(result.includes("C"));
});
