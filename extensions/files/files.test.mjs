import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import {
	sanitizeReference,
	stripLineSuffix,
	normalizeReferencePath,
	formatDisplayPath,
} from "./path-utils.ts";

// --- sanitizeReference ---

test("sanitizeReference strips leading quotes", () => {
	assert.equal(sanitizeReference('"hello"'), "hello");
	assert.equal(sanitizeReference("'hello'"), "hello");
});

test("sanitizeReference strips trailing punctuation", () => {
	assert.equal(sanitizeReference("/path/to/file.ts,"), "/path/to/file.ts");
	assert.equal(sanitizeReference("/path/to/file.ts."), "/path/to/file.ts");
});

test("sanitizeReference trims whitespace", () => {
	assert.equal(sanitizeReference("  /path/to/file.ts  "), "/path/to/file.ts");
});

// --- stripLineSuffix ---

test("stripLineSuffix removes #L<n> GitHub line anchors", () => {
	assert.equal(stripLineSuffix("/file.ts#L42"), "/file.ts");
});

test("stripLineSuffix removes #L<n>C<n> anchors", () => {
	assert.equal(stripLineSuffix("/file.ts#L42C10"), "/file.ts");
});

test("stripLineSuffix removes colon-based line numbers", () => {
	assert.equal(stripLineSuffix("/file.ts:42"), "/file.ts");
	assert.equal(stripLineSuffix("/file.ts:42:10"), "/file.ts");
});

test("stripLineSuffix leaves clean paths unchanged", () => {
	assert.equal(stripLineSuffix("/path/to/file.ts"), "/path/to/file.ts");
});

// --- normalizeReferencePath ---

test("normalizeReferencePath returns null for empty string", () => {
	assert.equal(normalizeReferencePath("", "/cwd"), null);
});

test("normalizeReferencePath returns null for comment-like references", () => {
	assert.equal(normalizeReferencePath("//example.com/path", "/cwd"), null);
});

test("normalizeReferencePath resolves relative paths against cwd", () => {
	const result = normalizeReferencePath("src/index.ts", "/project");
	assert.equal(result, "/project/src/index.ts");
});

test("normalizeReferencePath leaves absolute paths unchanged", () => {
	const result = normalizeReferencePath("/absolute/path/file.ts", "/cwd");
	assert.equal(result, "/absolute/path/file.ts");
});

test("normalizeReferencePath expands ~ to home directory", () => {
	const result = normalizeReferencePath("~/projects/app.ts", "/cwd");
	assert.equal(result, path.join(os.homedir(), "projects/app.ts"));
});

test("normalizeReferencePath strips line-number suffixes before resolving", () => {
	const result = normalizeReferencePath("/file.ts:10", "/cwd");
	assert.equal(result, "/file.ts");
});

test("normalizeReferencePath strips trailing slashes", () => {
	const result = normalizeReferencePath("/path/to/dir/", "/cwd");
	assert.equal(result, "/path/to/dir");
});

test("normalizeReferencePath handles file:// URLs", () => {
	const result = normalizeReferencePath("file:///usr/local/bin/node", "/cwd");
	assert.equal(result, "/usr/local/bin/node");
});

// --- formatDisplayPath ---

test("formatDisplayPath returns relative path when inside cwd", () => {
	const result = formatDisplayPath("/project/src/index.ts", "/project");
	assert.equal(result, "src/index.ts");
});

test("formatDisplayPath returns absolute path when outside cwd", () => {
	const result = formatDisplayPath("/other/path/file.ts", "/project");
	assert.equal(result, "/other/path/file.ts");
});

test("formatDisplayPath handles exact cwd match by returning absolute", () => {
	// The cwd itself, not a child — should return absolute
	const result = formatDisplayPath("/project", "/project");
	assert.equal(result, "/project");
});
