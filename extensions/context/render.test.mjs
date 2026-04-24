import test from "node:test";
import assert from "node:assert/strict";
import { buildPlainText, buildViewLines, formatAgentFilesLabel, formatUsedSummary, getUsageBarParts } from "./render.ts";

const theme = {
	fg: (tone, text) => `<${tone}>${text}</${tone}>`,
	bold: (text) => `**${text}**`,
};

const usage = {
	messageTokens: 600,
	contextWindow: 4_000,
	effectiveTokens: 900,
	percent: 22.5,
	remainingTokens: 3_100,
	systemPromptTokens: 250,
	agentTokens: 120,
	toolsTokens: 300,
	activeTools: 4,
};

const viewData = {
	usage,
	agentFiles: ["./AGENTS.md", "./nested/CLAUDE.md"],
	extensions: ["answer.ts", "context"],
	skills: [
		{ name: "github", loaded: true, tokens: 320 },
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

test("uses a distinct label for discovered agent files", () => {
	assert.equal(formatAgentFilesLabel(2), "Agent files (2)");
});

test("summarizes used tokens separately from total window usage", () => {
	assert.equal(formatUsedSummary(usage), "~900 tok (system ~250 · tools ~300 · convo ~350)");
});

test("renders plain text context summary from extracted helpers", () => {
	assert.equal(
		buildPlainText(viewData),
		[
			"Context",
			"Window: ~900 / 4,000 (22.5% used, ~3,100 left)",
			"Used: ~900 tok (system ~250 · tools ~300 · convo ~350)",
			"System: ~250 tok (agent-file content ~120)",
			"Tools: ~300 tok (4 active)",
			"Agent files (2): ./AGENTS.md, ./nested/CLAUDE.md",
			"Extensions (2): answer.ts, context",
			"Skills (2): github (~320 tok), uv (not loaded)",
			"Session: 1,234 tokens · $0.125",
		].join("\n"),
	);
});

test("renders loaded skills distinctly in the TUI view helper", () => {
	const lines = buildViewLines(theme, viewData, 80);
	assert.equal(lines[0], "<muted>Window: </muted><text>~900 / 4,000</text><muted>  (22.5% used, ~3,100 left)</muted>");
	assert.match(lines[1], /<dim>used<\/dim><accent>█<\/accent> <dim>free<\/dim><dim>█<\/dim>/);
	assert.equal(lines[2], "<muted>Used: </muted><text>~900 tok (system ~250 · tools ~300 · convo ~350)</text>");
	assert.match(lines[3], /<dim>system<\/dim><accent>█<\/accent> <dim>tools<\/dim><warning>█<\/warning> <dim>convo<\/dim><success>█<\/success>/);
	assert.equal(lines[5], "<muted>System: </muted><text>~250 tok (agent-file content ~120)</text>");
	assert.equal(lines[6], "<muted>Tools: </muted><text>~300 tok (4 active)</text>");
	assert.equal(lines[7], "<muted>Agent files (2): </muted><text>./AGENTS.md, ./nested/CLAUDE.md</text>");
	assert.equal(lines[9], "<muted>Extensions (2): </muted><text>answer.ts, context</text>");
	assert.equal(lines[10], "<muted>Skills (2): </muted><success>github (~320 tok)</success><muted>, </muted><muted>uv (not loaded)</muted>");
});
