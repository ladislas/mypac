import { formatUsd } from "./data.ts";
import type { ContextSkillData, ContextUsageData, ContextViewData } from "./data.ts";

export type ThemeLike = {
	fg: (tone: string, text: string) => string;
	bold: (text: string) => string;
};

type BarSegment = {
	value: number;
	tone: string;
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

function getUsedTokens(usage: ContextUsageData): number {
	const parts = getUsageBarParts(usage);
	return parts.system + parts.tools + parts.conversation;
}

function renderBar(theme: ThemeLike, segments: BarSegment[], total: number, width: number): string {
	const barWidth = Math.max(10, width);
	if (total <= 0) return "";

	const sizedSegments = segments.map((segment) => ({
		...segment,
		columns: Math.round((segment.value / total) * barWidth),
	}));
	let assigned = sizedSegments.reduce((sum, segment) => sum + segment.columns, 0);
	while (assigned < barWidth && sizedSegments.length > 0) {
		sizedSegments[sizedSegments.length - 1]!.columns += 1;
		assigned += 1;
	}
	while (assigned > barWidth) {
		const segment = sizedSegments.findLast((item) => item.columns > 0);
		if (!segment) break;
		segment.columns -= 1;
		assigned -= 1;
	}

	return sizedSegments.map((segment) => theme.fg(segment.tone, "█".repeat(segment.columns))).join("");
}

export function joinComma(items: string[]): string {
	return items.join(", ");
}

function joinCommaStyled<T>(items: T[], renderItem: (item: T) => string, separator: string): string {
	return items.map(renderItem).join(separator);
}

export function formatUsedSummary(usage: ContextUsageData): string {
	const parts = getUsageBarParts(usage);
	return `~${getUsedTokens(usage).toLocaleString()} tok (system ~${parts.system.toLocaleString()} · tools ~${parts.tools.toLocaleString()} · convo ~${parts.conversation.toLocaleString()})`;
}

export function formatSystemSummary(usage: ContextUsageData): string {
	return `~${usage.systemPromptTokens.toLocaleString()} tok (agent-file content ~${usage.agentTokens.toLocaleString()})`;
}

export function formatToolsSummary(usage: ContextUsageData): string {
	return `~${usage.toolsTokens.toLocaleString()} tok (${usage.activeTools} active)`;
}

export function formatAgentFilesLabel(count: number): string {
	return `Agent files (${count})`;
}

function formatSkillLabel(skill: ContextSkillData): string {
	if (!skill.loaded) return `${skill.name} (not loaded)`;
	const tokens = skill.tokens == null ? "~? tok" : `~${skill.tokens.toLocaleString()} tok`;
	return `${skill.name} (${tokens})`;
}

export function formatSkillsPlain(skills: ContextSkillData[]): string {
	return skills.length ? joinComma(skills.map(formatSkillLabel)) : "(none)";
}

export function formatSkillsStyled(skills: ContextSkillData[], theme: ThemeLike): string {
	if (skills.length === 0) return "(none)";
	return joinCommaStyled(
		skills,
		(skill) => (skill.loaded ? theme.fg("success", formatSkillLabel(skill)) : theme.fg("muted", formatSkillLabel(skill))),
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
		lines.push(`Used: ${formatUsedSummary(data.usage)}`);
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
		const parts = getUsageBarParts(data.usage);
		const usedTokens = getUsedTokens(data.usage);
		lines.push(
			muted("Window: ") +
				text(`~${data.usage.effectiveTokens.toLocaleString()} / ${data.usage.contextWindow.toLocaleString()}`) +
				muted(`  (${data.usage.percent.toFixed(1)}% used, ~${data.usage.remainingTokens.toLocaleString()} left)`),
		);
		lines.push(
			renderBar(
				theme,
				[
					{ value: usedTokens, tone: "accent" },
					{ value: data.usage.remainingTokens, tone: "dim" },
				],
				data.usage.contextWindow,
				barWidth,
			) +
				" " +
				dim("used") +
				theme.fg("accent", "█") +
				" " +
				dim("free") +
				theme.fg("dim", "█"),
		);
		lines.push(muted("Used: ") + text(formatUsedSummary(data.usage)));
		lines.push(
			renderBar(
				theme,
				[
					{ value: parts.system, tone: "accent" },
					{ value: parts.tools, tone: "warning" },
					{ value: parts.conversation, tone: "success" },
				],
				Math.max(usedTokens, 1),
				barWidth,
			) +
				" " +
				dim("system") +
				theme.fg("accent", "█") +
				" " +
				dim("tools") +
				theme.fg("warning", "█") +
				" " +
				dim("convo") +
				theme.fg("success", "█"),
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
