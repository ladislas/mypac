import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	abbreviatePath,
	analyzeSessionDirectory,
	formatCompactBreakdownReport,
	formatBreakdownReport,
	getDefaultSessionRoot,
	parseSessionLines,
	parseSessionStartFromFilename,
} from "./helpers.ts";
import { resolveAgentDir } from "../../lib/agent-dir.ts";

const day = (iso) => new Date(iso);

function jsonl(records) {
	return records.map((record) => (typeof record === "string" ? record : JSON.stringify(record))).join("\n") + "\n";
}

function stripMarkdownLinks(text) {
	return text.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
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
	assert.equal(parsed.totalCost.toFixed(2), "0.15");
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

test("parseSessionLines uses current model for provider-only messages", () => {
	const parsed = parseSessionLines(
		jsonl([
			{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
			{ type: "model_change", provider: "openai-codex", modelId: "gpt-5.5" },
			{ type: "message", provider: "openai-codex", usage: { totalTokens: 10 } },
		]),
		"2026-05-20T10-00-00-000Z_abc.jsonl",
	);

	assert.ok(parsed);
	assert.equal(parsed.messagesByModel.get("openai-codex/gpt-5.5"), 1);
	assert.equal(parsed.messagesByModel.has("openai-codex"), false);
});

test("parseSessionLines estimates market cost for subscription-backed Copilot Claude messages", () => {
	const parsed = parseSessionLines(
		jsonl([
			{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
			{
				type: "message",
				provider: "github-copilot",
				model: "claude-sonnet",
				usage: { inputTokens: 1_000_000, outputTokens: 100_000, cost: { total: 0 } },
			},
		]),
		"2026-05-20T10-00-00-000Z_abc.jsonl",
	);

	assert.ok(parsed);
	assert.equal(parsed.totalCost, 4.5);
	assert.equal(parsed.estimatedCost, 4.5);
	assert.equal(parsed.costByModel.get("github-copilot/claude-sonnet"), 4.5);
});

test("parseSessionLines estimates Copilot cache read and write market costs", () => {
	const parsed = parseSessionLines(
		jsonl([
			{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
			{
				type: "message",
				provider: "github-copilot",
				model: "claude-sonnet",
				usage: { cacheReadTokens: 2_000_000, cacheWriteTokens: 400_000, cost: { total: 0 } },
			},
		]),
		"2026-05-20T10-00-00-000Z_abc.jsonl",
	);

	assert.ok(parsed);
	assert.equal(parsed.tokens, 2_400_000);
	assert.equal(parsed.cacheReadTokens, 2_000_000);
	assert.equal(parsed.cacheWriteTokens, 400_000);
	assert.equal(parsed.totalCost, 2.1);
	assert.equal(parsed.estimatedCost, 2.1);
});

test("parseSessionLines preserves reported costs over Copilot market estimates", () => {
	const parsed = parseSessionLines(
		jsonl([
			{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
			{
				type: "message",
				provider: "github-copilot",
				model: "claude-sonnet",
				usage: { inputTokens: 1_000_000, outputTokens: 100_000, cost: { total: 0.12 } },
			},
		]),
		"2026-05-20T10-00-00-000Z_abc.jsonl",
	);

	assert.ok(parsed);
	assert.equal(parsed.totalCost, 0.12);
	assert.equal(parsed.estimatedCost, 0);
});

test("formatCompactBreakdownReport labels estimated market costs", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-"));
	try {
		await mkdir(join(root, "--project--"));
		await writeFile(
			join(root, "--project--", "2026-05-20T10-00-00-000Z_copilot.jsonl"),
			jsonl([
				{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
				{ type: "message", provider: "github-copilot", model: "claude-sonnet", usage: { inputTokens: 1_000_000, outputTokens: 100_000 } },
			]),
		);

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-20T12:00:00.000Z") });
		const text = formatCompactBreakdownReport(report, { homeDir: "/Users/alice", color: false });

		assert.match(text, /Cost note: includes estimated market cost for subscription-included usage/);
		assert.match(text, /github-copilot\/claude-sonnet\s+1\s+1\s+1\.1M\s+\$4\.50/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("analyzeSessionDirectory aggregates session costs and inferred workflow categories", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-"));
	try {
		await mkdir(join(root, "--project--"));
		const sessions = [
			["2026-05-20T10-00-00-000Z_pac-llat.jsonl", "/Users/alice/dev/project", "openai-codex", "gpt-5.5", 100, 1],
			["2026-05-20T11-00-00-000Z_grill-design.jsonl", "/Users/alice/dev/project", "openai-codex", "gpt-5.5", 200, 2],
			["2026-05-20T12-00-00-000Z_review.jsonl", "/Users/alice/dev/project", "anthropic", "claude", 300, 3],
			["2026-05-20T13-00-00-000Z_feature-thing.jsonl", "/Users/alice/dev/project", "anthropic", "claude", 400, 4],
		];
		for (const [name, cwd, provider, model, totalTokens, totalCost] of sessions) {
			await writeFile(
				join(root, "--project--", name),
				jsonl([
					{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd },
					{ type: "message", provider, model, usage: { totalTokens, cost: { total: totalCost } } },
				]),
			);
		}

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		const range = report.ranges.get(7);
		assert.ok(range);
		assert.deepEqual(range.sessionCosts, [1, 2, 3, 4]);
		assert.equal(range.workflowStats.get("llat")?.totalCost, 1);
		assert.equal(range.workflowStats.get("grill")?.totalCost, 2);
		assert.equal(range.workflowStats.get("review")?.totalCost, 3);
		assert.equal(range.workflowStats.get("implementation")?.totalCost, 4);

		const text = formatBreakdownReport(report, { homeDir: "/Users/alice" });
		assert.match(text, /cost distribution: avg\/session \$2\.50 · median \$2\.50 · p90 \$4\.00 · max \$4\.00/);
		assert.match(text, /top expensive sessions:\n    - 2026-05-20 · .*feature-thing\.jsonl: \$4\.00/);
		assert.match(text, /cost by workflow type:\n    - implementation: \$4\.00 · avg\/session \$4\.00 · sessions 1 · messages 1 · tokens 400/);
		assert.match(text, /cost by model:\n    - anthropic\/claude: \$7\.00 · avg\/message \$3\.50 · avg\/session \$3\.50/);
		assert.match(text, /cost by directory:\n    - ~\/dev\/project: \$10\.00 · avg\/message \$2\.50 · avg\/session \$2\.50/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
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

test("analyzeSessionDirectory reports malformed JSONL lines", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-"));
	try {
		await writeFile(
			join(root, "2026-05-20T10-00-00-000Z_bad-line.jsonl"),
			jsonl([
				{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
				"{bad json",
				{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { totalTokens: 10 } },
			]),
		);

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		assert.equal(report.skippedLines, 1);
		assert.match(formatBreakdownReport(report, { homeDir: "/Users/alice" }), /Warning: skipped 1 malformed JSONL line/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("analyzeSessionDirectory handles missing session directories gracefully", async () => {
	const root = join(tmpdir(), `missing-session-breakdown-${Date.now()}`);
	const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
	assert.equal(report.scannedFiles, 0);
	assert.equal(report.parsedSessions, 0);
	assert.equal(report.unreadableFiles, 0);
	assert.equal(report.skippedLines, 0);
	assert.equal(report.aborted, false);
	assert.equal(report.ranges.get(7)?.sessions, 0);
});

test("analyzeSessionDirectory reports unreadable directory scans", async () => {
	const root = join(tmpdir(), `session-breakdown-not-dir-${Date.now()}.jsonl`);
	try {
		await writeFile(root, "not a directory");
		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		assert.equal(report.scannedFiles, 0);
		assert.equal(report.unreadableFiles, 1);
		assert.match(report.lastError ?? "", /Could not read/);
		assert.match(formatBreakdownReport(report), /Warning: skipped 1 unreadable file/);
	} finally {
		await rm(root, { force: true });
	}
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

test("formatCompactBreakdownReport leads with overview, insights, bars, and outliers", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-"));
	try {
		await mkdir(join(root, "--project--"));
		const sessions = [
			["2026-05-20T10-00-00-000Z_one.jsonl", "/Users/alice/dev/project", "openai-codex", "gpt-5.5", 1_000_000, 10],
			["2026-05-21T10-00-00-000Z_two.jsonl", "/Users/alice/dev/project", "openai-codex", "gpt-5.5", 500_000, 8],
			["2026-05-22T10-00-00-000Z_three.jsonl", "/Users/alice/dev/other", "anthropic", "claude", 100_000, 2],
			["2026-05-01T10-00-00-000Z_four.jsonl", "/Users/alice/dev/older", "anthropic", "claude", 100_000, 1],
		];
		for (const [name, cwd, provider, model, totalTokens, totalCost] of sessions) {
			await writeFile(
				join(root, "--project--", name),
				jsonl([
					{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd },
					{ type: "message", provider, model, usage: { totalTokens, cost: { total: totalCost } } },
				]),
			);
		}

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		const text = formatCompactBreakdownReport(report, { homeDir: "/Users/alice", color: false });

		assert.match(text, /Overview/);
		assert.match(text, /│ 7d\s+│ 3\s+│ 3\s+│ 1\.6M\s+│ \$20\.00\s+│ \$2\.86\s+│/);
		assert.match(text, /Insights/);
		assert.match(text, /Current pace projects to ~\$86\/month/);
		assert.match(text, /🔥 Usage is accelerating: 7d daily cost is 4\.1× the 30d average/);
		assert.match(text, /🎯 Top 3 sessions account for 100\.0% of 7d cost/);
		assert.match(text, /📈 Last 7d already represents 95\.2% of 90d spend/);
		assert.match(text, /Cost by model · 30d spend share/);
		assert.match(text, /openai-codex\/gpt-5\.5\s+\$18\.00\s+█+/);
		assert.match(text, /Cost by directory · 30d spend share/);
		assert.match(text, /~\/dev\/project\s+\$18\.00\s+█+/);
		assert.match(text, /Outliers · 7d/);
		assert.match(text, /Most expensive session: \$10\.00 · one · project · project/);
		assert.match(text, /Top 3 sessions: \$20\.00 · 100\.0% of 7d cost/);
		assert.match(text, /Main cost center: ~\/dev\/project · 85\.7% of 30d spend/);
		assert.doesNotMatch(text, /^🔴 \$10\.00\s+2026-05-20/m);
		assert.doesNotMatch(text, /Use --details for the full breakdown/);
		assert.doesNotMatch(text, /one\.jsonl/);
		assert.match(text, /Session drill-down · 7d · top 5 by cost/);
		assert.match(text, /Model drill-down · 30d · top 5 by cost/);
		assert.match(text, /Directory drill-down · 30d · top 5 by cost/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("formatCompactBreakdownReport keeps overview rows aligned for large values", async () => {
	const report = await analyzeSessionDirectory({ root: join(tmpdir(), `missing-session-breakdown-${Date.now()}`) });
	const range = report.ranges.get(7);
	assert.ok(range);
	range.sessions = 1_234_567_890;
	range.totalMessages = 9_876_543_210;
	range.totalTokens = 12_345_678_901_234;
	range.totalCost = 123_456_789;
	report.parsedSessions = range.sessions;

	const text = formatCompactBreakdownReport(report, { color: false });
	const border = text.split("\n").find((line) => line.startsWith("┌"));
	const row = text.split("\n").find((line) => line.startsWith("│ 7d"));

	assert.ok(border);
	assert.ok(row);
	assert.equal(row.length, border.length);
	assert.match(row, /…/);
});

test("formatBreakdownReport computes cost distribution without spreading large arrays", async () => {
	const report = await analyzeSessionDirectory({ root: join(tmpdir(), `missing-session-breakdown-${Date.now()}`) });
	const range = report.ranges.get(7);
	assert.ok(range);
	range.sessions = 200_000;
	range.sessionCosts = Array.from({ length: range.sessions }, (_, index) => index % 1000);
	report.scannedFiles = range.sessions;
	report.parsedSessions = range.sessions;

	const text = formatBreakdownReport(report);
	assert.match(text, /cost distribution: avg\/session \$499\.50 · median \$499\.50 · p90 \$899\.00 · max \$999\.00/);
});

test("formatCompactBreakdownReport adds readable drill-down sections below the dashboard", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-"));
	try {
		const rows = [
			["2026-05-20T10-00-00-000Z_019e50ce-6073-787c-b2c6-81913fb09d05.jsonl", "/Users/alice/dev/ladislas/mypac", "openai-codex", "gpt-5.5", 120, 18_400_000, 16.92, "ladislas/mypac lwot - issue #279"],
			["2026-05-21T10-00-00-000Z_019e4ad9-1111-2222-3333-444444b3d00c.jsonl", "/Users/alice/dev/ladislas/mypac", "openai-codex", "gpt-5.5", 80, 13_100_000, 13.82, "ladislas/mypac lwot - issue #265"],
			["2026-05-22T10-00-00-000Z_019e459d-1111-2222-3333-4444447fc1d9.jsonl", "/Users/alice/dev/other", "opencode-go", "glm-5.1", 30, 10_900_000, 5.84, "Other implementation"],
		];
		for (const [name, cwd, provider, model, messages, tokens, cost, title] of rows) {
			const perMessageTokens = Math.floor(tokens / messages);
			const perMessageCost = cost / messages;
			await writeFile(
				join(root, name),
				jsonl([
					{ type: "session", timestamp: name.replace(/_(.+)\.jsonl$/, "Z").replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z"), cwd },
					{ type: "session_info", name: title },
					...Array.from({ length: messages }, () => ({ type: "message", provider, model, usage: { totalTokens: perMessageTokens, cost: { total: perMessageCost } } })),
				]),
			);
		}

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		const text = stripMarkdownLinks(formatCompactBreakdownReport(report, { homeDir: "/Users/alice", color: false }));

		assert.match(text, /Session drill-down · 7d · top 5 by cost\nCost\s+Date\s+ID\s+Msgs\s+Tokens\s+Main model\s+Title/);
		assert.match(text, /\$16\.92\s+2026-05-20\s+019e50ce…b09d05\s+120\s+18\.4M\s+gpt-5\.5\s+mypac · lwot - issue #279/);
		assert.match(text, /Model drill-down · 30d · top 5 by cost\nModel\s+Sessions\s+Msgs\s+Tokens\s+Cost\s+\$\/msg\s+\$\/1M tok/);
		assert.match(text, /openai-codex\/gpt-5\.5\s+2\s+200\s+31\.5M\s+\$30\.74\s+\$0\.1537\s+\$0\.98/);
		assert.match(text, /Directory drill-down · 30d · top 5 by cost\nDirectory\s+Sessions\s+Msgs\s+Tokens\s+Cost\s+Avg\/session/);
		assert.match(text, /~\/dev\/ladislas\/mypac\s+2\s+200\s+31\.5M\s+\$30\.74\s+\$15\.37/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("formatCompactBreakdownReport renders directory average session costs with two decimals", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-"));
	try {
		const rows = [
			["2026-05-20T10-00-00-000Z_one.jsonl", "/Users/alice/dev/project", 0.5045],
			["2026-05-21T10-00-00-000Z_two.jsonl", "/Users/alice/dev/project", 0.5045],
			["2026-05-22T10-00-00-000Z_three.jsonl", "/Users/alice/dev/other", 0.5882],
		];
		for (const [name, cwd, totalCost] of rows) {
			await writeFile(
				join(root, name),
				jsonl([
					{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd },
					{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { totalTokens: 100, cost: { total: totalCost } } },
				]),
			);
		}

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		const text = formatCompactBreakdownReport(report, { homeDir: "/Users/alice", color: false });
		const directorySection = text.slice(text.indexOf("Directory drill-down"));

		assert.match(directorySection, /~\/dev\/project\s+2\s+2\s+200\s+\$1\.01\s+\$0\.50/);
		assert.match(directorySection, /~\/dev\/other\s+1\s+1\s+100\s+\$0\.5882\s+\$0\.59/);
		assert.doesNotMatch(directorySection, /\$0\.5045/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("formatCompactBreakdownReport truncates drill-down rows to one terminal line", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-"));
	try {
		await writeFile(
			join(root, "2026-05-20T10-00-00-000Z_019e50ce-6073-787c-b2c6-81913fb09d05.jsonl"),
			jsonl([
				{ type: "session", id: "019e50ce-6073-787c-b2c6-81913fb09d05", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/worktrees/ladislas/mypac/ladislas-feature-237-investigate-agent-stuff-session-breakdown-extension-for-usage-stats" },
				{ type: "session_info", name: "This is a very long compact session breakdown title that should not wrap in a normal terminal" },
				{ type: "message", provider: "openai-codex-with-a-very-long-provider-name", model: "gpt-5.5-ultra-long-model-name", usage: { totalTokens: 25_700_000, cost: { total: 22.76 } } },
			]),
		);

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		const text = formatCompactBreakdownReport(report, { homeDir: "/Users/alice", color: false });
		const sessionRow = text.split("\n").find((line) => line.includes("019e50ce…b09d05") && line.includes("$22.76"));
		const directoryRow = text.split("\n").find((line) => line.startsWith("~/dev/ladislas/mypac") && line.includes("$22.76"));

		assert.ok(sessionRow);
		assert.ok(sessionRow.length <= 120, `session row should stay one line: ${sessionRow.length}`);
		assert.match(sessionRow, /…/);
		assert.ok(directoryRow);
		assert.ok(directoryRow.length <= 120, `directory row should stay one line: ${directoryRow.length}`);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("formatCompactBreakdownReport includes cache and context metrics when available", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-"));
	try {
		await writeFile(
			join(root, "2026-05-20T10-00-00-000Z_019e50ce-6073-787c-b2c6-81913fb09d05.jsonl"),
			jsonl([
				{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
				{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 21_000_000, cacheWriteTokens: 1_000_000, contextTokens: 100_000, maxContextTokens: 200_000, cost: { total: 1 } } },
				{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { inputTokens: 1000, outputTokens: 250, cacheReadTokens: 42_000_000, cacheWriteTokens: 2_000_000, contextTokens: 140_000, maxContextTokens: 240_000, cost: { total: 1 } } },
			]),
		);

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		const text = formatCompactBreakdownReport(report, { homeDir: "/Users/alice", color: false });

		assert.match(text, /Cache \/ context · 7d/);
		assert.match(text, /Cache read\/write\s+63\.0M \/ 3\.0M tokens/);
		assert.match(text, /Cache leverage\s+21\.0× read per write/);
		assert.match(text, /Avg context\s+120\.0k \/ 240\.0k/);
		assert.match(text, /Context pressure\s+50%/);
		assert.match(text, /Input\/output\s+2\.7×/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("formatCompactBreakdownReport classifies cache health thresholds", async () => {
	const cases = [
		[50, "excellent reuse"],
		[10, "good reuse"],
		[3, "moderate reuse"],
		[2, "low reuse"],
	];
	for (const [leverage, label] of cases) {
		const root = await mkdtemp(join(tmpdir(), "session-breakdown-cache-"));
		try {
			await writeFile(
				join(root, "2026-05-20T10-00-00-000Z_019e50ce-6073-787c-b2c6-81913fb09d05.jsonl"),
				jsonl([
					{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
					{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { cacheReadTokens: leverage * 1000, cacheWriteTokens: 1000, cost: { total: 1 } } },
				]),
			);
			const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
			const text = formatCompactBreakdownReport(report, { homeDir: "/Users/alice", color: false });
			assert.match(text, new RegExp(`Cache health\\s+${label}`));
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}
});

test("formatCompactBreakdownReport groups git worktrees under the canonical repo directory", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-worktree-"));
	try {
		const mainRepo = join(root, "dev/ladislas/mypac");
		const worktree = join(root, "dev/worktrees/ladislas/mypac/feature-280-focused-session-statistics");
		const worktreeGitDir = join(mainRepo, ".git/worktrees/feature-280-focused-session-statistics");
		await mkdir(worktreeGitDir, { recursive: true });
		await mkdir(worktree, { recursive: true });
		await writeFile(join(worktree, ".git"), `gitdir: ${worktreeGitDir}\n`);
		await writeFile(join(worktreeGitDir, "commondir"), "../..\n");

		await writeFile(
			join(root, "2026-05-20T10-00-00-000Z_019e50ce-6073-787c-b2c6-81913fb09d05.jsonl"),
			jsonl([
				{ type: "session", id: "019e50ce-6073-787c-b2c6-81913fb09d05", timestamp: "2026-05-20T10:00:00.000Z", cwd: worktree },
				{ type: "session_info", name: "feature worktree session" },
				{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { totalTokens: 1000, cost: { total: 10 } } },
			]),
		);
		await writeFile(
			join(root, "2026-05-21T10-00-00-000Z_019e4ad9-1111-2222-3333-444444b3d00c.jsonl"),
			jsonl([
				{ type: "session", timestamp: "2026-05-21T10:00:00.000Z", cwd: mainRepo },
				{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { totalTokens: 2000, cost: { total: 5 } } },
			]),
		);

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		const text = formatCompactBreakdownReport(report, { homeDir: root, color: false });
		const directoryRow = text.split("\n").find((line) => line.startsWith("~/dev/ladislas/mypac") && line.includes("$7.50"));
		const sessionRow = text.split("\n").find((line) => line.includes("019e50ce…b09d05"));

		assert.match(directoryRow ?? "", /^~\/dev\/ladislas\/mypac\s+2\s+2\s+3,000\s+\$15\.00\s+\$7\.50/);
		assert.doesNotMatch(text, /feature-280-focused-session-statistics\s+2\s+2\s+3,000/);
		assert.match(sessionRow ?? "", /feature worktree session/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("formatCompactBreakdownReport groups historical worktree paths even when the worktree no longer exists", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-missing-worktree-"));
	try {
		const missingWorktree = "/Users/alice/dev/worktrees/ladislas/mypac/feature-237-session-breakdown-extension";
		await writeFile(
			join(root, "2026-05-20T10-00-00-000Z_019e50ce-6073-787c-b2c6-81913fb09d05.jsonl"),
			jsonl([
				{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: missingWorktree },
				{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { totalTokens: 25_700_000, cost: { total: 22.76 } } },
			]),
		);

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		const text = formatCompactBreakdownReport(report, { homeDir: "/Users/alice", color: false });

		assert.match(text, /~\/dev\/ladislas\/mypac\s+1\s+1\s+25\.7M\s+\$22\.76\s+\$22\.76/);
		assert.doesNotMatch(text, /feature-237-session-breakdown-extension\s+1\s+1\s+25\.7M\s+\$22\.76\s+\$22\.76/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("formatCompactBreakdownReport truncates long spend-share labels so rows do not wrap", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-"));
	try {
		await writeFile(
			join(root, "2026-05-20T10-00-00-000Z_019e50ce-6073-787c-b2c6-81913fb09d05.jsonl"),
			jsonl([
				{
					type: "session",
					timestamp: "2026-05-20T10:00:00.000Z",
					cwd: "/Users/alice/dev/worktrees/ladislas/mypac/ladislas-feature-237-investigate-agent-stuff-session-breakdown-extension-for-usage-stats",
				},
				{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { totalTokens: 100, cost: { total: 22.76 } } },
			]),
		);

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		const text = formatCompactBreakdownReport(report, { homeDir: "/Users/alice", color: false });
		const row = text.split("\n").find((line) => line.startsWith("~/dev/ladislas/mypac"));

		assert.ok(row);
		assert.match(row, /^~\/dev\/ladislas\/mypac\s+\$22\.76\s+█+\s+100\.0%$/);
		assert.ok(row.length <= 100, `row should stay compact: ${row.length}`);
		assert.doesNotMatch(text, /ladislas-feature-237-investigate/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("formatCompactBreakdownReport renders identifiable outliers without full JSONL paths", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-"));
	try {
		const longTitle = "This is an extremely long session title that should be truncated before it wraps in compact mode";
		await writeFile(
			join(root, "2026-05-20T10-00-00-000Z_019e50ce-6073-787c-b2c6-81913fb09d05.jsonl"),
			jsonl([
				{ type: "session", id: "019e50ce-6073-787c-b2c6-81913fb09d05", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
				{ type: "session_info", name: "Add compact cost report" },
				{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { totalTokens: 100, cost: { total: 16.92 } } },
			]),
		);
		await writeFile(
			join(root, "2026-05-21T10-00-00-000Z_019e4ad9-1111-2222-3333-4444443d00c.jsonl"),
			jsonl([
				{ type: "session", timestamp: "2026-05-21T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
				{ type: "message", message: { role: "user", content: "Footer token budget indicators" } },
				{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { totalTokens: 100, cost: { total: 13.82 } } },
			]),
		);
		await writeFile(
			join(root, "2026-05-22T10-00-00-000Z_019e459d-1111-2222-3333-444444fc1d9.jsonl"),
			jsonl([
				{ type: "session", timestamp: "2026-05-22T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
				{ type: "session_info", name: longTitle },
				{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { totalTokens: 100, cost: { total: 12.28 } } },
			]),
		);

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		const text = formatCompactBreakdownReport(report, { homeDir: "/Users/alice", color: false });
		const outlierLines = [
			text.split("\n").find((line) => line.includes("Most expensive session")) ?? "",
			text.split("\n").find((line) => line.includes("Top 3 sessions:")) ?? "",
			text.split("\n").find((line) => line.includes("Main cost center")) ?? "",
		];
		const sessionRows = text.split("\n").filter((line) => line.startsWith("$") && line.includes("019e"));

		assert.match(outlierLines[0], /Most expensive session: \$16\.92 · 019e50ce…b09d05 · project · Add compact cost report/);
		assert.match(outlierLines[1], /Top 3 sessions: \$43\.02 · 100\.0% of 7d cost/);
		assert.match(outlierLines[2], /Main cost center: ~\/dev\/project · 100\.0% of 30d spend/);
		assert.doesNotMatch(text, /^🔴 \$16\.92\s+2026-05-20/m);
		assert.match(sessionRows[2], /\$12\.28\s+2026-05-22\s+019e459d…4fc1d9\s+1\s+100\s+gpt-5\.5\s+project · This is an extremely long…/);
		assert.ok(sessionRows.every((line) => line.length <= 120));
		assert.doesNotMatch(text, /\.jsonl/);
		assert.doesNotMatch(text, /\/Users\/alice\/dev\/project/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("formatCompactBreakdownReport summarizes GitHub issue URLs in outlier titles", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-"));
	try {
		await writeFile(
			join(root, "2026-05-20T10-00-00-000Z_019e50ce-6073-787c-b2c6-81913fb09d05.jsonl"),
			jsonl([
				{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
				{ type: "message", message: { role: "user", content: "lwot - https://github.com/ladislas/mypac/issues/280" } },
				{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { totalTokens: 100, cost: { total: 16.92 } } },
			]),
		);
		await writeFile(
			join(root, "2026-05-21T10-00-00-000Z_019e4ad9-1111-2222-3333-444444b3d00c.jsonl"),
			jsonl([
				{ type: "session", timestamp: "2026-05-21T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
				{ type: "message", message: { role: "user", content: "issue #265: Footer token budget indicators" } },
				{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { totalTokens: 100, cost: { total: 13.82 } } },
			]),
		);

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		const text = formatCompactBreakdownReport(report, { homeDir: "/Users/alice", color: false });
		const outlierLine = text.split("\n").find((line) => line.includes("Most expensive session"));
		const sessionRows = text.split("\n").filter((line) => line.startsWith("$") && line.includes("019e"));

		assert.equal(stripMarkdownLinks(outlierLine ?? ""), " 🔴 Most expensive session: $16.92 · 019e50ce…b09d05 · project · lwot - issue #280");
		assert.match(outlierLine ?? "", /\[issue #280\]\(https:\/\/github\.com\/ladislas\/mypac\/issues\/280\)/);
		assert.match(stripMarkdownLinks(sessionRows[0] ?? ""), /^\$16\.92\s+2026-05-20\s+019e50ce…b09d05\s+2\s+100\s+gpt-5\.5\s+project · lwot - issue #280$/);
		assert.match(sessionRows[0] ?? "", /\[issue #280\]\(https:\/\/github\.com\/ladislas\/mypac\/issues\/280\)/);
		assert.match(stripMarkdownLinks(sessionRows[1] ?? ""), /^\$13\.82\s+2026-05-21\s+019e4ad9…b3d00c\s+2\s+100\s+gpt-5\.5\s+project · issue #265 - Footer token…$/);
		assert.ok(sessionRows.every((line) => !line.includes(".jsonl")));
		assert.ok(sessionRows.every((line) => !/github\.com\/ladislas\/mypac\/issues\/\d+\s+-/.test(line)));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("parseSessionLines cleans compact fallback titles from GitHub issue URLs", () => {
	const cases = [
		["github.com/ladislas/mypac/issues/279", "issue #279"],
		["github.com/ladislas/mypac/issues/279%20-%20compact%20session%20breakdown", "issue #279"],
		["https://github.com/ladislas/mypac/issues/279 - compact session breakdown", "issue #279"],
		["github.com/ladislas/mypac/issues/279%20-%20Add%20compact%20cost%20report", "issue #279"],
		["lwot - github.com/ladislas/mypac/issues/279%20-%20-%20additional%20notes", "lwot - issue #279"],
		["lwot - github.com/ladislas/mypac/issues/279%20-%20Add%20compact%20cost%20report", "lwot - issue #279"],
		["lwot - github.com/ladislas/mypac/issues/279%ZZ", "lwot - issue #279"],
		["lwot - issue #265", "lwot - issue #265"],
	];

	for (const [input, expected] of cases) {
		const parsed = parseSessionLines(
			jsonl([
				{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
				{ type: "message", message: { role: "user", content: input } },
			]),
			"2026-05-20T10-00-00-000Z_019e50ce-6073-787c-b2c6-81913fb09d05.jsonl",
		);
		assert.equal(stripMarkdownLinks(parsed?.title ?? ""), expected);
		assert.doesNotMatch(parsed?.title ?? "", /github\.com\/ladislas\/mypac\/issues\/279(?:%|\s|-)/);
	}
});

test("parseSessionLines cleans explicit session titles from GitHub issue URLs", () => {
	const parsed = parseSessionLines(
		jsonl([
			{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
			{ type: "session_info", name: "lwot - github.com/ladislas/mypac/issues/279%20-%20Add%20compact%20cost%20report" },
		]),
		"2026-05-20T10-00-00-000Z_019e50ce-6073-787c-b2c6-81913fb09d05.jsonl",
	);

	assert.equal(stripMarkdownLinks(parsed?.title ?? ""), "lwot - issue #279");
	assert.doesNotMatch(parsed?.title ?? "", /github\.com\/ladislas\/mypac\/issues\/279(?:%|\s|-)/);
});

test("parseSessionLines links bare issue refs using inferred cwd repo", () => {
	const parsed = parseSessionLines(
		jsonl([
			{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/worktrees/ladislas/mypac/feature-thing" },
			{ type: "session_info", name: "lwot - issue #265" },
		]),
		"2026-05-20T10-00-00-000Z_019e50ce-6073-787c-b2c6-81913fb09d05.jsonl",
	);

	assert.equal(stripMarkdownLinks(parsed?.title ?? ""), "lwot - issue #265");
	assert.match(parsed?.title ?? "", /\[issue #265\]\(https:\/\/github\.com\/ladislas\/mypac\/issues\/265\)/);
});

test("parseSessionLines does not infer GitHub repos from flat dev project subdirectories", () => {
	const parsed = parseSessionLines(
		jsonl([
			{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project/src" },
			{ type: "session_info", name: "issue #280" },
		]),
		"2026-05-20T10-00-00-000Z_019e50ce-6073-787c-b2c6-81913fb09d05.jsonl",
	);

	assert.equal(parsed?.title, "issue #280");
	assert.doesNotMatch(parsed?.title ?? "", /github\.com\/project\/src\/issues\/280/);
});

test("parseSessionLines can infer GitHub repos from owner-matching home dev paths", () => {
	const parsed = parseSessionLines(
		jsonl([
			{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/alice/project" },
			{ type: "session_info", name: "issue #280" },
		]),
		"2026-05-20T10-00-00-000Z_019e50ce-6073-787c-b2c6-81913fb09d05.jsonl",
	);

	assert.match(parsed?.title ?? "", /\[issue #280\]\(https:\/\/github\.com\/alice\/project\/issues\/280\)/);
});

test("formatCompactBreakdownReport classifies workflow from session filename, not cwd", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-workflow-"));
	try {
		await writeFile(
			join(root, "2026-05-20T10-00-00-000Z_feature-thing.jsonl"),
			jsonl([
				{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/code-review-tool" },
				{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { totalTokens: 100, cost: { total: 1 } } },
			]),
		);

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		const range = report.ranges.get(7);
		assert.equal(range?.workflowStats.get("implementation")?.totalCost, 1);
		assert.equal(range?.workflowStats.has("review"), false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("formatCompactBreakdownReport does not classify preview filenames as review", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-workflow-"));
	try {
		await writeFile(
			join(root, "2026-05-20T10-00-00-000Z_preview-report.jsonl"),
			jsonl([
				{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
				{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { totalTokens: 100, cost: { total: 1 } } },
			]),
		);

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		const range = report.ranges.get(7);
		assert.equal(range?.workflowStats.get("other")?.totalCost, 1);
		assert.equal(range?.workflowStats.has("review"), false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("formatCompactBreakdownReport does not truncate inside markdown issue links", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-markdown-"));
	try {
		await writeFile(
			join(root, "2026-05-20T10-00-00-000Z_019e50ce-6073-787c-b2c6-81913fb09d05.jsonl"),
			jsonl([
				{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/worktrees/ladislas/mypac/feature-thing" },
				{ type: "session_info", name: "A compact report title with issue #280: additional details that force truncation" },
				{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { totalTokens: 100, cost: { total: 1 } } },
			]),
		);

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		const text = formatCompactBreakdownReport(report, { homeDir: "/Users/alice", color: false });
		const row = text.split("\n").find((line) => line.startsWith("$1.00") && line.includes("019e50ce…b09d05"));

		assert.ok(row);
		assert.doesNotMatch(row, /\[issue #280\]\(https:\/\/github\.com\/ladislas\/mypac\/issues\/280…/);
		assert.doesNotMatch(row, /github\.com\/ladislas\/mypac\/issues\/280[^)]*…/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("formatCompactBreakdownReport displays inferred repo for outliers", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-"));
	try {
		await writeFile(
			join(root, "2026-05-20T10-00-00-000Z_019e50ce-6073-787c-b2c6-81913fb09d05.jsonl"),
			jsonl([
				{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/worktrees/ladislas/mypac/feature-thing" },
				{ type: "message", message: { role: "user", content: "lwot - issue #265" } },
				{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { totalTokens: 100, cost: { total: 13.82 } } },
			]),
		);

		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		const text = formatCompactBreakdownReport(report, { homeDir: "/Users/alice", color: false });
		const row = text.split("\n").find((line) => line.startsWith("$13.82") && line.includes("019e50ce…b09d05"));

		assert.match(stripMarkdownLinks(row ?? ""), /^\$13\.82\s+2026-05-20\s+019e50ce…b09d05\s+2\s+100\s+gpt-5\.5\s+mypac · lwot - issue #265$/);
		assert.match(row ?? "", /\[issue #265\]\(https:\/\/github\.com\/ladislas\/mypac\/issues\/265\)/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("formatCompactBreakdownReport can emit semantic ANSI color", async () => {
	const root = await mkdtemp(join(tmpdir(), "session-breakdown-"));
	try {
		await writeFile(
			join(root, "2026-05-20T10-00-00-000Z_019e50ce-6073-787c-b2c6-81913fb09d05.jsonl"),
			jsonl([
				{ type: "session", timestamp: "2026-05-20T10:00:00.000Z", cwd: "/Users/alice/dev/project" },
				{ type: "message", provider: "openai-codex", model: "gpt-5.5", usage: { totalTokens: 100, cost: { total: 1 } } },
			]),
		);
		const report = await analyzeSessionDirectory({ root, now: day("2026-05-22T12:00:00.000Z") });
		const text = formatCompactBreakdownReport(report, { color: true });
		assert.match(text, /\u001b\[1mPi session breakdown\u001b\[22m/);
		assert.match(text, /\u001b\[36m█+/);
		assert.match(text, /\u001b\[31m🔴\u001b\[39m/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
