import { formatUsd } from "./data.ts";
import type { ContextPathTokens, ContextSkillData, ContextUsageData, ContextViewData } from "./data.ts";

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
	return {
		system: usage.systemPromptTokens,
		tools: usage.toolsTokens,
		conversation: usage.estimatedMessageTokens,
		remaining: usage.remainingTokens,
	};
}

function getUsedTokens(usage: ContextUsageData): number {
	return usage.usedTokens;
}

function getLoadedSkillTokens(skills: ContextSkillData[]): number {
	return skills.reduce((total, skill) => total + (skill.loaded ? Math.max(0, skill.tokens ?? 0) : 0), 0);
}

export function getUsedBreakdownParts(data: Pick<ContextViewData, "usage" | "skills">): {
	system: number;
	skills: number;
	tools: number;
	conversation: number;
} {
	if (!data.usage) {
		return { system: 0, skills: 0, tools: 0, conversation: 0 };
	}

	const usageParts = getUsageBarParts(data.usage);
	const skills = Math.min(Math.max(0, usageParts.conversation), getLoadedSkillTokens(data.skills));
	return {
		system: usageParts.system,
		skills,
		tools: usageParts.tools,
		conversation: Math.max(0, usageParts.conversation - skills),
	};
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
		let segment = undefined as (typeof sizedSegments)[number] | undefined;
		for (let index = sizedSegments.length - 1; index >= 0; index -= 1) {
			if (sizedSegments[index]!.columns > 0) {
				segment = sizedSegments[index];
				break;
			}
		}
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

function formatPathTokens(entry: ContextPathTokens): string {
	return `${entry.path} (~${entry.tokens.toLocaleString()} tok)`;
}

function formatPathTokenList(entries: ContextPathTokens[]): string {
	return entries.length ? joinComma(entries.map(formatPathTokens)) : "(none)";
}

export function formatUsedSummary(data: Pick<ContextViewData, "usage" | "skills">): string {
	if (!data.usage) return "~0 tok";
	const parts = getUsedBreakdownParts(data);
	return `~${getUsedTokens(data.usage).toLocaleString()} tok (system ~${parts.system.toLocaleString()} · skills ~${parts.skills.toLocaleString()} · tools ~${parts.tools.toLocaleString()} · convo ~${parts.conversation.toLocaleString()})`;
}

export function formatWindowDeltaSummary(data: Pick<ContextViewData, "usage">): string {
	if (!data.usage) return "~0 tok";
	const gap = data.usage.windowEffectiveTokens - data.usage.usedTokens;
	if (gap < 0) return `-${Math.abs(gap).toLocaleString()} tok (estimated tok > runtime tok)`;
	if (gap > 0) return `+${gap.toLocaleString()} tok (runtime tok > estimated tok)`;
	return `0 tok (estimated tok = runtime tok)`;
}

export function formatSystemSummary(data: Pick<ContextViewData, "systemBreakdown">): string {
	return data.systemBreakdown ? `~${data.systemBreakdown.totalTokens.toLocaleString()} tok` : "(unknown)";
}

export function formatToolsSummary(usage: ContextUsageData): string {
	return `~${usage.toolsTokens.toLocaleString()} tok (${usage.activeTools} active)`;
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
	lines.push("");
	if (data.usage) {
		lines.push(
			`Window: ~${data.usage.windowEffectiveTokens.toLocaleString()} / ${data.usage.contextWindow.toLocaleString()} (${data.usage.percent.toFixed(1)}% used, ~${data.usage.remainingTokens.toLocaleString()} left)`,
		);
		lines.push(`Estimated used: ${formatUsedSummary(data)}`);
	} else {
		lines.push("Window: (unknown)");
	}
	lines.push("");
	lines.push("Breakdown:");
	lines.push(`- System total: ${formatSystemSummary(data)}`);
	if (data.systemBreakdown) {
		lines.push(`  - Pi base + other system instructions: ~${data.systemBreakdown.piInstructionsTokens.toLocaleString()} tok`);
		if (data.systemBreakdown.sharedInstructions) {
			lines.push(`  - from shared root instructions: ${formatPathTokens(data.systemBreakdown.sharedInstructions)}`);
		}
		if (data.agentFiles.length > 0) lines.push(`  - from agent files: ${formatPathTokenList(data.agentFiles)}`);
		if (data.systemBreakdown.packageSkillsIndexTokens > 0) {
			lines.push(`  - from package skills index: ~${data.systemBreakdown.packageSkillsIndexTokens.toLocaleString()} tok`);
		}
		if (data.systemBreakdown.globalSkillsIndexTokens > 0) {
			lines.push(`  - from global skills index: ~${data.systemBreakdown.globalSkillsIndexTokens.toLocaleString()} tok`);
		}
		if (data.systemBreakdown.projectSkillsIndexTokens > 0) {
			lines.push(`  - from project skills index: ~${data.systemBreakdown.projectSkillsIndexTokens.toLocaleString()} tok`);
		}
	}
	if (data.usage) {
		lines.push(`- Pi tool definitions: ${formatToolsSummary(data.usage)}`);
		lines.push(`- Context window delta: ${formatWindowDeltaSummary(data)}`);
	}
	lines.push("");
	lines.push(`Extensions (${data.extensions.length}): ${data.extensions.length ? joinComma(data.extensions) : "(none)"}`);
	lines.push(`Skills available (${data.skills.length}): ${formatSkillsPlain(data.skills)}`);
	lines.push("");
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
		lines.push("");
		const barWidth = Math.max(10, Math.min(36, width - 10));
		const parts = getUsedBreakdownParts(data);
		const usedTokens = getUsedTokens(data.usage);
		lines.push(
			muted("Window: ") +
				text(`~${data.usage.windowEffectiveTokens.toLocaleString()} / ${data.usage.contextWindow.toLocaleString()}`) +
				muted(`  (${data.usage.percent.toFixed(1)}% used, ~${data.usage.remainingTokens.toLocaleString()} left)`),
		);
		lines.push(
			renderBar(
				theme,
				[
					{ value: data.usage.windowEffectiveTokens, tone: "accent" },
					{ value: data.usage.remainingTokens, tone: "dim" },
				],
				data.usage.contextWindow,
				barWidth,
			) +
				" " +
				dim("used ") +
				theme.fg("accent", "█") +
				" " +
				dim("free ") +
				theme.fg("dim", "█"),
		);
		lines.push(muted("Estimated used: ") + text(formatUsedSummary(data)));
		lines.push(
			renderBar(
				theme,
				[
					{ value: parts.system, tone: "accent" },
					{ value: parts.skills, tone: "text" },
					{ value: parts.tools, tone: "warning" },
					{ value: parts.conversation, tone: "success" },
				],
				Math.max(usedTokens, 1),
				barWidth,
			) +
				" " +
				dim("system ") +
				theme.fg("accent", "█") +
				" " +
				dim("skills ") +
				theme.fg("text", "█") +
				" " +
				dim("tools ") +
				theme.fg("warning", "█") +
				" " +
				dim("convo ") +
				theme.fg("success", "█"),
		);
	}

	lines.push("");
	lines.push(muted("Breakdown:"));
	lines.push(muted("- System total: ") + text(formatSystemSummary(data)));
	if (data.systemBreakdown) {
		lines.push(muted("  - Pi base + other system instructions: ") + text(`~${data.systemBreakdown.piInstructionsTokens.toLocaleString()} tok`));
		if (data.systemBreakdown.sharedInstructions) {
			lines.push(muted("  - from shared root instructions: ") + text(formatPathTokens(data.systemBreakdown.sharedInstructions)));
		}
		if (data.agentFiles.length > 0) lines.push(muted("  - from agent files: ") + text(formatPathTokenList(data.agentFiles)));
		if (data.systemBreakdown.packageSkillsIndexTokens > 0) {
			lines.push(muted("  - from package skills index: ") + text(`~${data.systemBreakdown.packageSkillsIndexTokens.toLocaleString()} tok`));
		}
		if (data.systemBreakdown.globalSkillsIndexTokens > 0) {
			lines.push(muted("  - from global skills index: ") + text(`~${data.systemBreakdown.globalSkillsIndexTokens.toLocaleString()} tok`));
		}
		if (data.systemBreakdown.projectSkillsIndexTokens > 0) {
			lines.push(muted("  - from project skills index: ") + text(`~${data.systemBreakdown.projectSkillsIndexTokens.toLocaleString()} tok`));
		}
	}
	if (data.usage) {
		lines.push(muted("- Pi tool definitions: ") + text(formatToolsSummary(data.usage)));
		lines.push(muted("- Context window delta: ") + text(formatWindowDeltaSummary(data)));
	}
	lines.push("");
	lines.push(muted(`Extensions (${data.extensions.length}): `) + text(data.extensions.length ? joinComma(data.extensions) : "(none)"));
	lines.push(muted(`Skills available (${data.skills.length}): `) + formatSkillsStyled(data.skills, theme));
	lines.push("");
	lines.push(muted("Session: ") + text(`${data.session.totalTokens.toLocaleString()} tokens`) + muted(" · ") + text(formatUsd(data.session.totalCost)));
	return lines;
}
