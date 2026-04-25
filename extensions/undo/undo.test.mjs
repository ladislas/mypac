import test from "node:test";
import assert from "node:assert/strict";
import { parseUndoContent } from "./helpers.ts";

test("handles plain string content", () => {
	const result = parseUndoContent("hello world");
	assert.equal(result.text, "hello world");
	assert.equal(result.hasNonTextContent, false);
});

test("handles empty string content", () => {
	const result = parseUndoContent("");
	assert.equal(result.text, "");
	assert.equal(result.hasNonTextContent, false);
});

test("handles array with a single text part", () => {
	const result = parseUndoContent([{ type: "text", text: "hello" }]);
	assert.equal(result.text, "hello");
	assert.equal(result.hasNonTextContent, false);
});

test("joins multiple text parts with newlines", () => {
	const result = parseUndoContent([
		{ type: "text", text: "line one" },
		{ type: "text", text: "line two" },
	]);
	assert.equal(result.text, "line one\nline two");
	assert.equal(result.hasNonTextContent, false);
});

test("detects non-text content (e.g. image)", () => {
	const result = parseUndoContent([
		{ type: "image", source: { type: "base64", mediaType: "image/png", data: "" } },
	]);
	assert.equal(result.hasNonTextContent, true);
	assert.equal(result.text, "");
});

test("extracts text from mixed content and flags non-text parts", () => {
	const result = parseUndoContent([
		{ type: "text", text: "describe this" },
		{ type: "image", source: { type: "base64", mediaType: "image/png", data: "" } },
	]);
	assert.equal(result.text, "describe this");
	assert.equal(result.hasNonTextContent, true);
});

test("returns empty text and no non-text for empty array", () => {
	const result = parseUndoContent([]);
	assert.equal(result.text, "");
	assert.equal(result.hasNonTextContent, false);
});
