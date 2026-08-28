import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

export interface SessionStats {
	name?: string;
	file?: string;
	id: string;
	messages: {
		total: number;
		user: number;
		assistant: number;
		toolCalls: number;
		toolResults: number;
	};
	tokens: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		total: number;
	};
	cost: number;
}

function numberValue(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function costTotal(usage: any): number {
	return numberValue(usage?.cost?.total ?? usage?.cost);
}

export function buildSessionStats(ctx: ExtensionCommandContext): SessionStats {
	let total = 0;
	let user = 0;
	let assistant = 0;
	let toolCalls = 0;
	let toolResults = 0;
	let input = 0;
	let output = 0;
	let cacheRead = 0;
	let cacheWrite = 0;
	let cost = 0;

	const addUsage = (usage: any): void => {
		input += numberValue(usage?.input);
		output += numberValue(usage?.output);
		cacheRead += numberValue(usage?.cacheRead);
		cacheWrite += numberValue(usage?.cacheWrite);
		cost += costTotal(usage);
	};

	for (const entry of ctx.sessionManager.getEntries()) {
		if ((entry.type === "branch_summary" || entry.type === "compaction") && entry.usage) addUsage(entry.usage);
		if (entry.type !== "message") continue;

		total += 1;
		const message = entry.message;
		if (message.role === "user") user += 1;
		if (message.role === "toolResult") {
			toolResults += 1;
			if (message.usage) addUsage(message.usage);
		}
		if (message.role !== "assistant") continue;

		assistant += 1;
		if (Array.isArray(message.content)) toolCalls += message.content.filter((part) => part.type === "toolCall").length;
		addUsage(message.usage);
	}

	return {
		name: ctx.sessionManager.getSessionName(),
		file: ctx.sessionManager.getSessionFile(),
		id: ctx.sessionManager.getSessionId(),
		messages: { total, user, assistant, toolCalls, toolResults },
		tokens: { input, output, cacheRead, cacheWrite, total: input + output + cacheRead + cacheWrite },
		cost,
	};
}

export interface SessionTextStyle {
	heading(text: string): string;
	label(text: string): string;
}

const plainStyle: SessionTextStyle = {
	heading: (text) => text,
	label: (text) => text,
};

export function buildSessionLines(stats: SessionStats, style: SessionTextStyle = plainStyle): string[] {
	const promptTokens = stats.tokens.input + stats.tokens.cacheRead + stats.tokens.cacheWrite;
	const lines = [style.heading("Session Info"), ""];
	if (stats.name) lines.push(`${style.label("Name:")} ${stats.name}`);
	lines.push(
		`${style.label("File:")} ${stats.file ?? "In-memory"}`,
		`${style.label("ID:")} ${stats.id}`,
		"",
		style.heading("Messages"),
		`${style.label("Total:")} ${stats.messages.total}`,
		`${style.label("User:")} ${stats.messages.user}`,
		`${style.label("Assistant:")} ${stats.messages.assistant}`,
		`${style.label("Tool Calls:")} ${stats.messages.toolCalls}`,
		`${style.label("Tool Results:")} ${stats.messages.toolResults}`,
		"",
		style.heading("Tokens"),
		`${style.label("Input:")} ${promptTokens.toLocaleString()}`,
	);
	if (promptTokens > 0 && (stats.tokens.cacheRead > 0 || stats.tokens.cacheWrite > 0)) {
		lines.push(`${style.label("Cached:")} ${stats.tokens.cacheRead.toLocaleString()} (${((stats.tokens.cacheRead / promptTokens) * 100).toFixed(1)}%)`);
		lines.push(`${style.label("Uncached:")} ${(stats.tokens.input + stats.tokens.cacheWrite).toLocaleString()}`);
	}
	lines.push(`${style.label("Output:")} ${stats.tokens.output.toLocaleString()}`, `${style.label("Total:")} ${stats.tokens.total.toLocaleString()}`);
	if (stats.cost > 0) lines.push("", style.heading("Cost"), `${style.label("Total:")} $${stats.cost.toFixed(3)}`);
	return lines;
}

export function buildSessionText(stats: SessionStats): string {
	return buildSessionLines(stats).join("\n");
}
