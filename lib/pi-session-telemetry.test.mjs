import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parsePiSessionLines } from "./pi-session-telemetry.ts";

const jsonl = (records) => records.map((record) => typeof record === "string" ? record : JSON.stringify(record)).join("\n") + "\n";

test("parses trustworthy usage and configuration telemetry from a Pi session", () => {
	const parsed = parsePiSessionLines(jsonl([
		{ type: "session", id: "session-1", timestamp: "2026-01-01T00:00:00.000Z", cwd: "/tmp/repo" },
		{ type: "model_change", provider: "openai-codex", modelId: "requested-model" },
		{ type: "thinking_level_change", thinkingLevel: "high" },
		{ type: "message", message: { role: "user", content: "do work" } },
		{ type: "message", message: { role: "assistant", provider: "openai-codex", model: "actual-model", usage: {
			input: 10, output: 5, cacheRead: 3, cacheWrite: 2, totalTokens: 20,
			contextTokens: 15, maxContextTokens: 100, cost: { total: 0.2, totalFromProvider: true },
		} } },
	]), "session.jsonl");

	assert.equal(parsed.sessionId, "session-1");
	assert.equal(parsed.messages, 2);
	assert.equal(parsed.assistantTurns, 1);
	assert.deepEqual(parsed.modelsUsed, new Set(["openai-codex/requested-model", "openai-codex/actual-model"]));
	assert.deepEqual(parsed.actualConfiguration, { provider: "openai-codex", model: "actual-model", thinking: "high" });
	assert.deepEqual(parsed.contextTokenSamples, [15]);
	assert.equal(parsed.maxContextTokens, 100);
	assert.equal(parsed.tokens, 20);
	assert.equal(parsed.totalCost, 0.2);
	assert.equal(parsed.availability.totalTokens, true);
	assert.equal(parsed.availability.reportedCost, true);
});

test("separates provider, catalog, and historical costs without replacing explicit zero", () => {
	const cases = [
		[{ total: 0, totalFromProvider: true }, 0, 0, 0, true],
		[{ total: 2, totalFromProvider: true }, 2, 0, 0, true],
		[{ total: 2, totalFromProvider: false }, 0, 2, 0, false],
		[{ total: 0, totalFromProvider: false }, 0, 0, 0, false],
		[{ total: 2 }, 0, 0, 2, false],
		[{ total: 0 }, 0, 0, 0, false],
		[{ total: 2, totalFromProvider: "true" }, 0, 0, 2, false],
		[2, 0, 0, 2, false],
		[undefined, 0, 3, 0, false],
		[{ totalFromProvider: true }, 0, 3, 0, false],
	];
	for (const [cost, reported, estimated, unknown, providerAvailable] of cases) {
		const parsed = parsePiSessionLines(jsonl([
			{ type: "message", message: { role: "assistant", provider: "github-copilot", model: "claude-sonnet", usage: { input: 1_000_000, cost } } },
		]));
		assert.equal(parsed.reportedCost, reported, JSON.stringify(cost));
		assert.equal(parsed.estimatedCost, estimated);
		assert.equal(parsed.unknownCost, unknown);
		assert.equal(parsed.totalCost, reported + estimated + unknown);
		assert.equal(parsed.availability.reportedCost, providerAvailable);
		assert.equal(parsed.tokens, 1_000_000);
	}
});

test("aggregates mixed per-message and per-model costs in legacy and usage-ledger sessions", () => {
	const messages = [
		{ id: "1", provider: "openrouter", model: "requested", responseModel: "byok", cost: { total: 2, totalFromProvider: true } },
		{ id: "2", provider: "openrouter", model: "byok", cost: { total: 3, totalFromProvider: false } },
		{ id: "3", provider: "anthropic", model: "historical", cost: { total: 4 } },
	];
	for (const ledger of [false, true]) {
		const records = ledger ? [{ kind: "header", version: 4 }] : [];
		for (const { cost, ...fields } of messages) {
			const usage = { input: 10, output: 5, cost };
			records.push({ type: "message", ...fields, message: { role: "assistant", usage } });
			if (ledger) records.push({ kind: "record", type: "usage", cause: "assistant", entryId: fields.id, usage });
		}
		const parsed = parsePiSessionLines(jsonl(records));
		assert.equal(parsed.reportedCost, 2);
		assert.equal(parsed.estimatedCost, 3);
		assert.equal(parsed.unknownCost, 4);
		assert.equal(parsed.totalCost, 9);
		assert.equal(parsed.tokens, 45);
		assert.deepEqual(parsed.costByModel, new Map([["openrouter/byok", 5], ["anthropic/historical", 4]]));
	}
});

test("uses per-turn total tokens as context samples when provider omits dedicated context telemetry", () => {
	const parsed = parsePiSessionLines(jsonl([
		{ type: "message", message: { role: "assistant", provider: "openai-codex", model: "luna", usage: { totalTokens: 120 } } },
		{ type: "message", message: { role: "assistant", provider: "openai-codex", model: "luna", usage: { totalTokens: 240 } } },
		{ type: "message", message: { role: "assistant", provider: "openai-codex", model: "luna", usage: { totalTokens: 180 } } },
	]));

	assert.deepEqual(parsed.contextTokenSamples, [120, 240, 180]);
	assert.equal(parsed.availability.context, true);
});

test("session-breakdown and pac-eval share one parsing implementation", async () => {
	const [breakdown, evaluation] = await Promise.all([
		readFile(new URL("../extensions/session-breakdown/helpers.ts", import.meta.url), "utf8"),
		readFile(new URL("../scripts/pac-eval.ts", import.meta.url), "utf8"),
	]);
	assert.match(breakdown, /from "\.\.\/\.\.\/lib\/pi-session-telemetry\.ts"/);
	assert.match(evaluation, /from "\.\.\/lib\/pi-session-telemetry\.ts"/);
	assert.doesNotMatch(breakdown, /function extractTokens\s*\(/);
	assert.doesNotMatch(evaluation, /function extractTokens\s*\(/);
});

test("partial malformed sessions retain exposed facts and mark unavailable usage", () => {
	const parsed = parsePiSessionLines(jsonl([
		{ type: "session", id: "partial", timestamp: "2026-01-01T00:00:00.000Z" },
		{ type: "model_change", provider: "anthropic", modelId: "claude" },
		"{broken",
	]), "session.jsonl");

	assert.equal(parsed.sessionId, "partial");
	assert.equal(parsed.skippedLines, 1);
	assert.equal(parsed.tokens, 0);
	assert.equal(parsed.availability.totalTokens, false);
	assert.equal(parsed.availability.reportedCost, false);
	assert.deepEqual(parsed.actualConfiguration, { provider: "anthropic", model: "claude", thinking: null });
});
