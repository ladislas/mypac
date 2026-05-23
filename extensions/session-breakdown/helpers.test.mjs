import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	abbreviatePath,
	analyzeSessionDirectory,
	formatBreakdownReport,
	getDefaultSessionRoot,
	parseSessionLines,
	parseSessionStartFromFilename,
	resolveAgentDir,
} from "./helpers.ts";

const day = (iso) => new Date(iso);

function jsonl(records) {
	return records.map((record) => (typeof record === "string" ? record : JSON.stringify(record))).join("\n") + "\n";
}

test("parseSessionStartFromFilename reads Pi session filename timestamps", () => {
	assert.equal(
		parseSessionStartFromFilename("2026-02-02T21-52-28-774Z_abc.jsonl")?.toISOString(),
		"2026-02-02T21:52:28.774Z",
	);
	assert.equal(parseSessionStartFromFilename("not-a-session.jsonl"), null);
});

test("getDefaultSessionRoot honors custom Pi agent directory env vars", () => {
	assert.equal(resolveAgentDir({ PI_CODING_AGENT_DIR: "~/custom-agent" }, "/Users/alice"), "/Users/alice/custom-agent");
	assert.equal(getDefaultSessionRoot({ ACME_CODING_AGENT_DIR: "/tmp/acme-agent" }, "/Users/alice"), "/tmp/acme-agent/sessions");
	assert.equal(getDefaultSessionRoot({}, "/Users/alice"), "/Users/alice/.pi/agent/sessions");
});

test("parseSessionLines handles metadata, model changes, usage shapes, and malformed lines", () => {
	const parsed = parseSessionLines(
		jsonl([
			{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
			{ type: "model_change", provider: "openai-codex", modelId: "gpt-5.5" },
			{ type: "message", message: { role: "user", content: "hello" } },
			{
				type: "message",
				message: {
					role: "assistant",
					provider: "anthropic",
					model: "claude-sonnet-4-5",
					usage: { promptTokens: 100, completionTokens: 25, cost: { total: 0.12 } },
				},
			},
			"{not json",
			{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { total_tokens: "42", cost: "0.03" } },
		]),
		"2026-05-20T09-59-00-000Z_abc.jsonl",
	);

	assert.ok(parsed);
	assert.equal(parsed.cwd, "/Users/alice/dev/project");
	assert.equal(parsed.messages, 3);
	assert.equal(parsed.tokens, 167);
	assert.equal(parsed.totalCost, 0.15);
	assert.equal(parsed.messagesByModel.get("openai-codex/gpt-5.5"), 2);
	assert.equal(parsed.messagesByModel.get("anthropic/claude-sonnet-4-5"), 1);
	assert.equal(parsed.tokensByModel.get("anthropic/claude-sonnet-4-5"), 125);
});

test("parseSessionLines prefers message modelId when model is missing or blank", () => {
	const parsed = parseSessionLines(
		jsonl([
			{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
			{ type: "message", provider: "openai-codex", modelId: "gpt-5.5", usage: { totalTokens: 10 } },
			{ type: "message", provider: "openai-codex", model: " ", modelId: "gpt-5.5", usage: { totalTokens: 20 } },
		]),
		"2026-05-20T10-00-00-000Z_abc.jsonl",
	);

	assert.ok(parsed);
	assert.equal(parsed.messagesByModel.get("openai-codex/gpt-5.5"), 2);
	assert.equal(parsed.messagesByModel.has("openai-codex"), false);
});

test("analyzeSessionDirectory aggregates 7, 30, and 90 day windows by model and cwd", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-"));
	try {
		await mkdir(join(root, "--project--"));
		await writeFile(
			join(root, "--project--", "2026-05-20T10-00-00-000Z_one.jsonl"),
			jsonl([
				{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
				{ type: "model_change", provider: "openai-codex", modelId: "gpt-5.5" },
				{ type: "message", message: { role: "assistant", usage: { totalTokens: 100, cost: { total: 0.5 } } } },
			]),
		);
		await writeFile(
			join(root, "--project--", "2026-04-30T10-00-00-000Z_two.jsonl"),
			jsonl([
				{ type: "session", timestamp: "2026-04-30T10:00:00.000Z", cwd: "/Users/alice/dev/older" },
				{ type: "message", provider: "anthropic", model: "claude", usage: { input: 10, output: 5, cost: { total: 0.2 } } },
			]),
		);
		await writeFile(
			join(root, "--project--", "2026-02-01T10-00-00-000Z_old.jsonl"),
			jsonl([{ type: "session", timestamp: "2026-02-01T10:00:00.000Z", cwd: "/Users/alice/dev/old" }]),
		);

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		assert.equal(report.scannedFiles, 2);
		assert.equal(report.parsedSessions, 2);
		assert.equal(report.ranges.get(7)?.sessions, 1);
		assert.equal(report.ranges.get(30)?.sessions, 2);
		assert.equal(report.ranges.get(90)?.sessions, 2);
		assert.equal(report.ranges.get(7)?.totalTokens, 100);
		assert.equal(report.ranges.get(30)?.modelMessages.get("anthropic/claude"), 1);
		assert.equal(report.ranges.get(30)?.cwdSessions.get("/Users/alice/dev/project"), 1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("analyzeSessionDirectory handles missing session directories gracefully", async () => {
	const root = join(tmpdir(), `missing-session-breakdown-${Date.now()}`);
	const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
	assert.equal(report.scannedFiles, 0);
	assert.equal(report.parsedSessions, 0);
	assert.equal(report.aborted, false);
	assert.equal(report.ranges.get(7)?.sessions, 0);
});

test("analyzeSessionDirectory marks aborted scans", async () => {
	const controller = new AbortController();
	controller.abort();
	const report = await analyzeSessionDirectory({
		root: join(tmpdir(), `missing-session-breakdown-${Date.now()}`),
		now: day("2026-05-22T12:00:00.000Z"),
		signal: controller.signal,
	});
	assert.equal(report.aborted, true);
});

test("formatBreakdownReport summarizes totals without raw message content", async () => {
	const report = await analyzeSessionDirectory({
		root: join(tmpdir(), `missing-session-breakdown-${Date.now()}`),
		now: day("2026-05-22T12:00:00.000Z"),
	});
	const text = formatBreakdownReport(report, { homeDir: "/Users/alice" });
	assert.match(text, /Pi session breakdown/);
	assert.match(text, /Last 7 days/);
	assert.match(text, /No session files found/);
	assert.doesNotMatch(text, /hello from fixture|assistant response from fixture/i);
});

test("formatBreakdownReport abbreviates Windows-style paths", async () => {
	const report = await analyzeSessionDirectory({
		root: join(tmpdir(), `missing-session-breakdown-${Date.now()}`),
		now: day("2026-05-22T12:00:00.000Z"),
	});
	const range = report.ranges.get(7);
	assert.ok(range);
	range.cwdSessions.set("C:\\Users\\alice\\dev\\very\\long\\project\\with\\many\\nested\\private\\segments", 1);

	const text = formatBreakdownReport(report, { homeDir: "C:\\Users\\alice" });
	assert.match(text, /~\/…\/.*segments: 1/);
	assert.doesNotMatch(text, /C:\\Users\\alice\\dev\\very\\long/);
});

test("abbreviatePath respects home path boundaries and preserves absolute roots", () => {
	assert.equal(abbreviatePath("/Users/alice2/dev/project", "/Users/alice"), "/Users/alice2/dev/project");
	assert.equal(
		abbreviatePath("/var/folders/private/pi/session/breakdown/with/many/segments", "/Users/alice", 32),
		"/var/…/with/many/segments",
	);
});

test("formatBreakdownReport includes model and directory token/cost breakdowns when present", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-"));
	try {
		await mkdir(join(root, "--project--"));
		await writeFile(
			join(root, "--project--", "2026-05-20T10-00-00-000Z_one.jsonl"),
			jsonl([
				{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
				{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { totalTokens: 100, cost: { total: 0.5 } } },
			]),
		);

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		const text = formatBreakdownReport(report, { homeDir: "/Users/alice" });
		assert.match(text, /tokens by model:\n    - openai-codex\/gpt-5\.5: 100/);
		assert.match(text, /cost by model:\n    - openai-codex\/gpt-5\.5: \$0\.5000/);
		assert.match(text, /messages by directory:\n    - ~\/dev\/project: 1/);
		assert.match(text, /tokens by directory:\n    - ~\/dev\/project: 100/);
		assert.match(text, /cost by directory:\n    - ~\/dev\/project: \$0\.5000/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
