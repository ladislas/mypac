import test from "node:test";
import assert from "node:assert/strict";
import {
	normalizeQuestions,
	parseExtractionResult,
	formatExtractionFailure,
} from "./extraction.ts";

// --- normalizeQuestions ---

test("normalizeQuestions accepts wrapped object with questions array", () => {
	const result = normalizeQuestions({ questions: [{ question: "What is your name?" }] });
	assert.deepEqual(result, { questions: [{ question: "What is your name?" }] });
});

test("normalizeQuestions accepts bare array of question objects", () => {
	const result = normalizeQuestions([{ question: "Where are you?" }]);
	assert.deepEqual(result, { questions: [{ question: "Where are you?" }] });
});

test("normalizeQuestions accepts bare array of strings", () => {
	const result = normalizeQuestions(["Why?", "How?"]);
	assert.deepEqual(result, { questions: [{ question: "Why?" }, { question: "How?" }] });
});

test("normalizeQuestions includes context when present", () => {
	const result = normalizeQuestions({
		questions: [{ question: "Which DB?", context: "Only MySQL or PostgreSQL are supported." }],
	});
	assert.deepEqual(result, {
		questions: [{ question: "Which DB?", context: "Only MySQL or PostgreSQL are supported." }],
	});
});

test("normalizeQuestions omits empty context", () => {
	const result = normalizeQuestions({ questions: [{ question: "Why?", context: "" }] });
	assert.deepEqual(result, { questions: [{ question: "Why?" }] });
});

test("normalizeQuestions filters out items with empty question", () => {
	const result = normalizeQuestions({ questions: [{ question: "" }, { question: "Valid?" }] });
	assert.deepEqual(result, { questions: [{ question: "Valid?" }] });
});

test("normalizeQuestions returns empty questions array for empty input array", () => {
	const result = normalizeQuestions({ questions: [] });
	assert.deepEqual(result, { questions: [] });
});

test("normalizeQuestions returns null for non-object/non-array input", () => {
	assert.equal(normalizeQuestions(null), null);
	assert.equal(normalizeQuestions(undefined), null);
	assert.equal(normalizeQuestions("string"), null);
	assert.equal(normalizeQuestions(42), null);
});

// --- parseExtractionResult ---

test("parseExtractionResult parses clean JSON object", () => {
	const json = JSON.stringify({ questions: [{ question: "What?" }] });
	const result = parseExtractionResult(json);
	assert.deepEqual(result, { questions: [{ question: "What?" }] });
});

test("parseExtractionResult parses JSON wrapped in markdown fences", () => {
	const text = '```json\n{"questions":[{"question":"Why?"}]}\n```';
	const result = parseExtractionResult(text);
	assert.deepEqual(result, { questions: [{ question: "Why?" }] });
});

test("parseExtractionResult parses JSON embedded in surrounding text", () => {
	const text = 'Here are the questions: {"questions":[{"question":"How?"}]} Hope that helps.';
	const result = parseExtractionResult(text);
	assert.deepEqual(result, { questions: [{ question: "How?" }] });
});

test("parseExtractionResult returns null for plain non-JSON text", () => {
	const result = parseExtractionResult("This is just some text with no JSON.");
	assert.equal(result, null);
});

test("parseExtractionResult returns null for empty string", () => {
	assert.equal(parseExtractionResult(""), null);
});

// --- formatExtractionFailure ---

test("formatExtractionFailure includes model output preview", () => {
	const msg = formatExtractionFailure("not valid json");
	assert.ok(msg.includes("Question extraction returned invalid JSON"));
	assert.ok(msg.includes("not valid json"));
});

test("formatExtractionFailure truncates long output", () => {
	const long = "x".repeat(500);
	const msg = formatExtractionFailure(long);
	assert.ok(msg.length < 300);
	assert.ok(msg.includes("..."));
});

test("formatExtractionFailure handles empty string", () => {
	const msg = formatExtractionFailure("   ");
	assert.equal(msg, "Question extraction returned invalid JSON.");
});
