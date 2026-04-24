import { formatUsd } from "./data.ts";
import type { ContextSkillData, ContextUsageData, ContextViewData } from "./data.ts";

export type ThemeLike = {
	fg: (tone: string, text: string) => string;
	bold: (text: string) => string;
};

export function getUsageBarParts(usage: ContextUsageData): {
	system: number;
	tools: number;
	conversation: number;
	remaining: number;
} {
	const system = Math.min(usage.systemPromptTokens, usage.messageTokens);
	return {
		system,
		tools: usage.toolsTokens,
		conversation: Math.max(0, usage.messageTokens - system),
		remaining: usage.remainingTokens,
	};
}

export function renderUsageBar(
	theme: ThemeLike,
	parts: { system: number; tools: number; conversation: number; remaining: number },
	total: number,
	width: number,
): string {
	const barWidth = Math.max(10, width);
	if (total <= 0) return "";

	const toColumns = (value: number) => Math.round((value / total) * barWidth);
	let system = toColumns(parts.system);
	let tools = toColumns(parts.tools);
	let conversation = toColumns(parts.conversation);
	let remaining = barWidth - system - tools - conversation;
	if (remaining < 0) remaining = 0;
	while (system + tools + conversation + remaining < barWidth) remaining++;
	while (system + tools + conversation + remaining > barWidth && remaining > 0) remaining--;

	const block = "█";
	return `${theme.fg("accent", block.repeat(system))}${theme.fg("warning", block.repeat(tools))}${theme.fg("success", block.repeat(conversation))}${theme.fg("dim", block.repeat(remaining))}`;
}

export function joinComma(items: string[]): string {
	return items.join(", ");
}

function joinCommaStyled(items: string[], renderItem: (item: string) => string, separator: string): string {
	return items.map(renderItem).join(separator);
}

export function formatSystemSummary(usage: ContextUsageData): string {
	return `~${usage.systemPromptTokens.toLocaleString()} tok (AGENTS ~${usage.agentTokens.toLocaleString()})`;
}

export function formatToolsSummary(usage: ContextUsageData): string {
	return `~${usage.toolsTokens.toLocaleString()} tok (${usage.activeTools} active)`;
}

export function formatAgentFilesLabel(count: number): string {
	return `AGENTS (${count})`;
}

export function formatSkillsPlain(skills: ContextSkillData[]): string {
	return skills.length ? joinComma(skills.map((skill) => skill.name)) : "(none)";
}

export function formatSkillsStyled(skills: ContextSkillData[], theme: ThemeLike): string {
	if (skills.length === 0) return "(none)";
	return joinCommaStyled(
		skills.map((skill) => skill.name),
		(name) => {
			const skill = skills.find((entry) => entry.name === name);
			return skill?.loaded ? theme.fg("success", name) : theme.fg("muted", name);
		},
		theme.fg("muted", ", "),
	);
}

export function buildPlainText(data: ContextViewData): string {
	const lines: string[] = [];
	lines.push("Context");
	if (data.usage) {
		lines.push(
			`Window: ~${data.usage.effectiveTokens.toLocaleString()} / ${data.usage.contextWindow.toLocaleString()} (${data.usage.percent.toFixed(1)}% used, ~${data.usage.remainingTokens.toLocaleString()} left)`,
		);
		lines.push(`System: ${formatSystemSummary(data.usage)}`);
		lines.push(`Tools: ${formatToolsSummary(data.usage)}`);
	} else {
		lines.push("Window: (unknown)");
	}
	lines.push(`${formatAgentFilesLabel(data.agentFiles.length)}: ${data.agentFiles.length ? joinComma(data.agentFiles) : "(none)"}`);
	lines.push(`Extensions (${data.extensions.length}): ${data.extensions.length ? joinComma(data.extensions) : "(none)"}`);
	lines.push(`Skills (${data.skills.length}): ${formatSkillsPlain(data.skills)}`);
	lines.push(`Session: ${data.session.totalTokens.toLocaleString()} tokens · ${formatUsd(data.session.totalCost)}`);
	return lines.join("\n");
}

export function buildViewLines(theme: ThemeLike, data: ContextViewData, width: number): string[] {
	const muted = (value: string) => theme.fg("muted", value);
	const dim = (value: string) => theme.fg("dim", value);
	const text = (value: string) => theme.fg("text", value);
	const lines: string[] = [];

	if (!data.usage) {
		lines.push(muted("Window: ") + dim("(unknown)"));
	} else {
		const barWidth = Math.max(10, Math.min(36, width - 10));
		lines.push(
			muted("Window: ") +
				text(`~${data.usage.effectiveTokens.toLocaleString()} / ${data.usage.contextWindow.toLocaleString()}`) +
				muted(`  (${data.usage.percent.toFixed(1)}% used, ~${data.usage.remainingTokens.toLocaleString()} left)`),
		);
		lines.push(
			renderUsageBar(theme, getUsageBarParts(data.usage), data.usage.contextWindow, barWidth) +
				" " +
				dim("sys") +
				theme.fg("accent", "█") +
				" " +
				dim("tools") +
				theme.fg("warning", "█") +
				" " +
				dim("convo") +
				theme.fg("success", "█") +
				" " +
				dim("free") +
				theme.fg("dim", "█"),
		);
	}

	lines.push("");
	if (data.usage) {
		lines.push(muted("System: ") + text(formatSystemSummary(data.usage)));
		lines.push(muted("Tools: ") + text(formatToolsSummary(data.usage)));
	}
	lines.push(muted(`${formatAgentFilesLabel(data.agentFiles.length)}: `) + text(data.agentFiles.length ? joinComma(data.agentFiles) : "(none)"));
	lines.push("");
	lines.push(muted(`Extensions (${data.extensions.length}): `) + text(data.extensions.length ? joinComma(data.extensions) : "(none)"));
	lines.push(muted(`Skills (${data.skills.length}): `) + formatSkillsStyled(data.skills, theme));
	lines.push("");
	lines.push(muted("Session: ") + text(`${data.session.totalTokens.toLocaleString()} tokens`) + muted(" · ") + text(formatUsd(data.session.totalCost)));
	return lines;
}
