import test from "node:test";
import assert from "node:assert/strict";
import {
	buildPlainText,
	buildViewLines,
	formatSystemSummary,
	formatUsedSummary,
	getUsageBarParts,
	getUsedBreakdownParts,
} from "./render.ts";

const theme = {
	fg: (tone, text) => `<${tone}>${text}</${tone}>`,
	bold: (text) => `**${text}**`,
};

const usage = {
	windowTokens: 600,
	contextWindow: 4_000,
	windowEffectiveTokens: 900,
	percent: 22.5,
	remainingTokens: 3_100,
	usedTokens: 900,
	estimatedMessageTokens: 350,
	systemPromptTokens: 250,
	toolsTokens: 300,
	activeTools: 4,
};

const viewData = {
	usage,
	systemBreakdown: {
		totalTokens: 250,
		piInstructionsTokens: 60,
		sharedInstructions: { path: "./shared/AGENTS.md", tokens: 40 },
		packageSkillsIndexTokens: 10,
		globalSkillsIndexTokens: 0,
		projectSkillsIndexTokens: 20,
	},
	agentFiles: [{ path: "./AGENTS.md", tokens: 120 }],
	extensions: ["answer.ts", "context"],
	skills: [
		{ name: "github", loaded: true, tokens: 120 },
		{ name: "uv", loaded: false, tokens: null },
	],
	session: { totalTokens: 1_234, totalCost: 0.125 },
};

test("splits usage bar parts into system, tools, conversation, and remaining", () => {
	assert.deepEqual(getUsageBarParts(usage), {
		system: 250,
		tools: 300,
		conversation: 350,
		remaining: 3_100,
	});
});

test("splits loaded skills out of conversation instead of subtracting them from system", () => {
	assert.deepEqual(getUsedBreakdownParts(viewData), {
		system: 250,
		skills: 120,
		tools: 300,
		conversation: 230,
	});

	assert.deepEqual(
		getUsedBreakdownParts({
			...viewData,
			skills: [{ name: "github", loaded: true, tokens: 500 }],
		}),
		{
			system: 250,
			skills: 350,
			tools: 300,
			conversation: 0,
		},
	);
});

test("summarizes used tokens separately from total window usage", () => {
	assert.equal(formatUsedSummary(viewData), "~900 tok (system ~250 · skills ~120 · tools ~300 · convo ~230)");
});

test("summarizes total system prompt usage", () => {
	assert.equal(formatSystemSummary(viewData), "~250 tok");
});

test("renders plain text context summary from extracted helpers", () => {
	assert.equal(
		buildPlainText(viewData),
		[
			"Context",
			"Window: ~900 / 4,000 (22.5% used, ~3,100 left)",
			"Used: ~900 tok (system ~250 · skills ~120 · tools ~300 · convo ~230)",
			"System total: ~250 tok",
			"- Pi base + other system instructions: ~60 tok",
			"- from shared root instructions: ./shared/AGENTS.md (~40 tok)",
			"- from agent files: ./AGENTS.md (~120 tok)",
			"- from package skills index: ~10 tok",
			"- from project skills index: ~20 tok",
			"Pi tool definitions: ~300 tok (4 active)",
			"Extensions (2): answer.ts, context",
			"Skills available (2): github (~120 tok), uv (not loaded)",
			"Session: 1,234 tokens · $0.125",
		].join("\n"),
	);
});

test("renders loaded skills and system breakdown distinctly in the TUI view helper", () => {
	const lines = buildViewLines(theme, viewData, 80);
	assert.equal(lines[0], "<muted>Window: </muted><text>~900 / 4,000</text><muted>  (22.5% used, ~3,100 left)</muted>");
	assert.match(lines[1], /<dim>used <\/dim><accent>█<\/accent> <dim>free <\/dim><dim>█<\/dim>/);
	assert.equal(lines[2], "<muted>Used: </muted><text>~900 tok (system ~250 · skills ~120 · tools ~300 · convo ~230)</text>");
	assert.match(lines[3], /<dim>system <\/dim><accent>█<\/accent> <dim>skills <\/dim><text>█<\/text> <dim>tools <\/dim><warning>█<\/warning> <dim>convo <\/dim><success>█<\/success>/);
	assert.equal(lines[5], "<muted>System total: </muted><text>~250 tok</text>");
	assert.equal(lines[6], "<muted>- Pi base + other system instructions: </muted><text>~60 tok</text>");
	assert.equal(lines[7], "<muted>- from shared root instructions: </muted><text>./shared/AGENTS.md (~40 tok)</text>");
	assert.equal(lines[8], "<muted>- from agent files: </muted><text>./AGENTS.md (~120 tok)</text>");
	assert.equal(lines[9], "<muted>- from package skills index: </muted><text>~10 tok</text>");
	assert.equal(lines[10], "<muted>- from project skills index: </muted><text>~20 tok</text>");
	assert.equal(lines[11], "<muted>Pi tool definitions: </muted><text>~300 tok (4 active)</text>");
	assert.equal(lines[13], "<muted>Extensions (2): </muted><text>answer.ts, context</text>");
	assert.equal(lines[14], "<muted>Skills available (2): </muted><success>github (~120 tok)</success><muted>, </muted><muted>uv (not loaded)</muted>");
});
