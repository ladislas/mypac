import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export interface FooterUsageTotals {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalCost: number;
}

export interface FooterModelRef {
	provider?: string;
	id?: string;
	reasoning?: boolean;
	contextWindow?: number;
}

export interface FooterContextUsage {
	tokens: number | null;
	contextWindow: number;
}

export interface FooterRenderData {
	cwd?: string;
	branch?: string | null;
	sessionId?: string;
	sessionName?: string;
	usage: FooterUsageTotals;
	usingSubscription: boolean;
	model?: FooterModelRef;
	thinkingLevel?: string;
	contextUsage?: FooterContextUsage;
	providerUsage?: FooterProviderUsage | null;
	headroomState?: FooterHeadroomState;
}

export interface FooterHeadroomState {
	status: "working" | "error" | "not_started";
	tokensSaved?: number;
	compressionPercent?: number;
}

export interface FooterUsageWindow {
	label: string;
	usedPercent: number;
	resetsIn?: string;
}

export interface FooterProviderUsage {
	provider: string;
	windows: FooterUsageWindow[];
}

const BAR_FILLED = "━";
const BAR_EMPTY = "─";

export function formatTokens(count: number): string {
	if (count < 1000) return Math.round(count).toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
	return `${Math.round(count / 1000000)}M`;
}

export function sumUsageFromEntries(entries: readonly unknown[]): FooterUsageTotals {
	const totals: FooterUsageTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalCost: 0 };
	for (const entry of entries as any[]) {
		const usage =
			entry?.type === "usage" || entry?.type === "compaction" || entry?.type === "branch_summary"
				? entry.usage
				: entry?.type === "message" && (entry.message?.role === "assistant" || entry.message?.role === "toolResult")
					? entry.message.usage
					: undefined;
		if (!usage) continue;
		totals.input += Number(usage.input ?? 0) || 0;
		totals.output += Number(usage.output ?? 0) || 0;
		totals.cacheRead += Number(usage.cacheRead ?? 0) || 0;
		totals.cacheWrite += Number(usage.cacheWrite ?? 0) || 0;
		totals.totalCost += Number(usage.cost?.total ?? usage.cost ?? 0) || 0;
	}
	return totals;
}

export function formatStatusSegment(usage: FooterUsageTotals, usingSubscription: boolean): string {
	const parts: string[] = [];
	if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
	if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
	if (usage.cacheRead) parts.push(`R${formatTokens(usage.cacheRead)}`);
	if (usage.cacheWrite) parts.push(`W${formatTokens(usage.cacheWrite)}`);
	if (usage.totalCost || usingSubscription) {
		parts.push(`$${usage.totalCost.toFixed(3)}${usingSubscription ? " (sub)" : ""}`);
	}
	return parts.join(" ");
}

export function getBudgetColor(remainingPercent: number): "success" | "warning" | "error" {
	if (remainingPercent <= 20) return "error";
	if (remainingPercent <= 40) return "warning";
	return "success";
}

export function getContextColor(tokens: number): "success" | "warning" | "error" {
	if (tokens >= 120_000) return "error";
	if (tokens >= 72_000) return "warning";
	return "success";
}

function getThinkingColor(thinkingLevel?: string): string {
	switch (thinkingLevel) {
		case "off":
			return "thinkingOff";
		case "minimal":
			return "thinkingMinimal";
		case "low":
			return "thinkingLow";
		case "medium":
			return "thinkingMedium";
		case "high":
			return "thinkingHigh";
		case "xhigh":
			return "thinkingXhigh";
		case "max":
			return "thinkingMax";
		default:
			return "accent";
	}
}

export function formatModelName(model?: FooterModelRef, _thinkingLevel?: string): string {
	if (!model?.id) return "no-model";
	const provider = model.provider ? `${model.provider}/` : "";
	return `${provider}${model.id}`;
}

export function formatLocationLine(data: Pick<FooterRenderData, "cwd" | "branch" | "sessionId" | "sessionName">): string {
	if (data.cwd) {
		let cwd = data.cwd;
		const home = process.env.HOME || process.env.USERPROFILE;
		if (home && cwd.startsWith(home)) cwd = `~${cwd.slice(home.length)}`;
		return data.branch ? `${cwd} · ${data.branch}` : cwd;
	}
	return "";
}

export function formatSessionLine(data: Pick<FooterRenderData, "sessionId" | "sessionName">): string {
	const meta = formatSessionMeta(data);
	return meta ? `session ${meta}` : "session";
}

function formatSessionMeta(data: Pick<FooterRenderData, "sessionId" | "sessionName">): string {
	const parts: string[] = [];
	if (data.sessionId) parts.push(data.sessionId.slice(0, 8));
	if (data.sessionName) parts.push(formatSessionName(data.sessionName));
	return parts.join(" · ");
}

function formatSessionName(name: string): string {
	return name.replace(/\s*-\s*issue\s+#(\d+)\b/i, " #$1").replace(/\bissue\s+#(\d+)\b/i, "#$1").replace(/\s+/g, " ").trim();
}

function renderTokenBar(tokens: number, contextWindow: number, theme: any): string {
	const width = 12;
	const percent = contextWindow > 0 ? Math.max(0, Math.min(100, (tokens / contextWindow) * 100)) : 0;
	const filled = Math.round((percent / 100) * width);
	const color = getContextColor(tokens);
	const bar = theme.fg(color, BAR_FILLED.repeat(filled)) + theme.fg("dim", BAR_EMPTY.repeat(width - filled));
	return `${theme.fg("dim", "ctx ")}${bar} ${theme.fg("dim", `${formatTokens(tokens)}/${formatTokens(contextWindow)}`)}`;
}

export function renderFooterLines(data: FooterRenderData, width: number, theme: any): string[] {
	const safeWidth = Math.max(1, width);
	const location = formatLocationLine(data);
	const sessionMeta = formatSessionMeta(data);
	const modelLine = buildModelSegments(data, theme).join(theme.fg("dim", " · "));
	const headroomSegment = buildHeadroomSegment(data, theme);
	const contextSegment = buildContextSegment(data, theme);
	const status = theme.fg("dim", formatStatusSegment(data.usage, data.usingSubscription));
	const contextPercent = buildContextPercentSegment(data, theme);
	const statusWithPercent = [status, contextPercent].filter((segment): segment is string => Boolean(segment)).join(" ");
	const budgetLine = [statusWithPercent, contextSegment].filter((segment): segment is string => Boolean(segment)).join(theme.fg("dim", " · "));
	const usageParts = buildFooterUsageParts(data.providerUsage, headroomSegment, theme, data.thinkingLevel);

	const wideLines = renderWideLines({ location, sessionMeta, modelLine, budgetLine, usageParts }, safeWidth, theme);
	if (wideLines) return wideLines;

	return renderNarrowLines({ location, sessionMeta, modelLine, budgetLine, usageParts }, safeWidth, theme);
}

function buildModelSegments(data: FooterRenderData, theme: any): string[] {
	const model = theme.fg("dim", formatModelName(data.model, data.thinkingLevel));
	const segments = [model];
	if (data.model?.reasoning && data.thinkingLevel && data.thinkingLevel !== "off") {
		segments.push(theme.fg(getThinkingColor(data.thinkingLevel), data.thinkingLevel));
	}
	return segments;
}

function buildHeadroomSegment(data: FooterRenderData, theme: any): string | null {
	const state = data.headroomState;
	if (!state) return null;
	const symbol = state.status === "working" ? theme.fg("success", "✓") : state.status === "error" ? theme.fg("error", "x") : theme.fg("warning", "-");
	const tokensSaved = formatTokens(state.tokensSaved ?? 0);
	const compressionPercent = Math.round(state.compressionPercent ?? 0);
	return `${theme.fg("dim", "Headroom ")}${symbol}${theme.fg("dim", ` (${tokensSaved}/${compressionPercent}%)`)}`;
}

function buildContextSegment(data: FooterRenderData, theme: any): string | null {
	const tokens = data.contextUsage?.tokens;
	const contextWindow = data.contextUsage?.contextWindow ?? data.model?.contextWindow ?? 0;
	if (tokens !== null && tokens !== undefined && contextWindow > 0) {
		return renderTokenBar(tokens, contextWindow, theme);
	}
	return null;
}

function buildContextPercentSegment(data: FooterRenderData, theme: any): string | null {
	const tokens = data.contextUsage?.tokens;
	const contextWindow = data.contextUsage?.contextWindow ?? data.model?.contextWindow ?? 0;
	if (tokens === null || tokens === undefined || contextWindow <= 0) return null;
	const percent = ((tokens / contextWindow) * 100).toFixed(1);
	return theme.fg("dim", `${percent}%/${formatTokens(contextWindow)}`);
}

interface RenderParts {
	location: string;
	sessionMeta: string;
	modelLine: string;
	budgetLine: string;
	usageParts: { left: string; windows: string[]; right?: string } | null;
}

function renderWideLines(parts: RenderParts, width: number, theme: any): string[] | null {
	const lines: string[] = [];
	const first = joinFirstLine(theme.fg("dim", parts.location), theme.fg("dim", parts.sessionMeta), width);
	if (!first) return null;
	if (parts.location) lines.push(first);

	const budgetModelLine = joinColumns(parts.budgetLine, parts.modelLine, width);
	if (!budgetModelLine) return null;
	lines.push(budgetModelLine);

	if (parts.usageParts) {
		lines.push(renderUsageLine(parts.usageParts, width, theme));
	}

	return lines.map((line) => truncateToWidth(line, width));
}

function renderNarrowLines(parts: RenderParts, width: number, theme: any): string[] {
	const lines: string[] = [];
	if (parts.location) lines.push(truncateToWidth(theme.fg("dim", parts.location), width));
	if (parts.sessionMeta) lines.push(truncateToWidth(theme.fg("dim", parts.sessionMeta), width));
	lines.push(truncateToWidth([parts.budgetLine, parts.modelLine].filter(Boolean).join(theme.fg("dim", " · ")), width));

	if (parts.usageParts) {
		lines.push(renderUsageLine(parts.usageParts, width, theme));
	}

	return lines;
}


function joinFirstLine(left: string, right: string, width: number): string | null {
	const minGap = 4;
	const minLocationWidth = 4;
	const rightWidth = visibleWidth(right);
	if (!left || !right || visibleWidth(left) + minGap + rightWidth <= width) return joinColumns(left, right, width);
	if (minLocationWidth + minGap + rightWidth > width) return null;

	const truncatedLeft = truncateToWidth(left, width - minGap - rightWidth);
	return truncatedLeft + " ".repeat(width - visibleWidth(truncatedLeft) - rightWidth) + right;
}

function joinColumns(left: string, right: string, width: number): string | null {
	const leftWidth = visibleWidth(left);
	const rightWidth = visibleWidth(right);
	if (!left && !right) return "";
	if (!right) return truncateToWidth(left, width);
	if (!left) return truncateToWidth(right, width);
	const minGap = 4;
	if (leftWidth + minGap + rightWidth > width) return null;
	return left + " ".repeat(width - leftWidth - rightWidth) + right;
}

function renderUsageBar(usedPercent: number, theme: any): string {
	const width = 10;
	const remainingPercent = Math.max(0, Math.min(100, 100 - usedPercent));
	const filled = Math.round((remainingPercent / 100) * width);
	const color = getBudgetColor(remainingPercent);
	return theme.fg(color, BAR_FILLED.repeat(filled)) + theme.fg("dim", BAR_EMPTY.repeat(width - filled));
}

export function renderProviderUsageLines(usage: FooterProviderUsage, width: number, theme: any, thinkingLevel?: string): string[] {
	const safeWidth = Math.max(1, width);
	const parts = buildUsageParts(usage, theme, thinkingLevel);
	return [renderUsageLine(parts, safeWidth, theme)];
}

function renderUsageLine(parts: { left: string; windows: string[]; right?: string }, width: number, theme: any): string {
	const left = [parts.left, ...parts.windows].filter(Boolean).join(theme.fg("dim", " · "));
	if (!parts.right) return truncateToWidth(left, width);
	const leftWidth = visibleWidth(left);
	const rightWidth = visibleWidth(parts.right);
	const minGap = 3;
	if (!left) return truncateToWidth(parts.right, width);
	if (leftWidth + minGap + rightWidth > width) return truncateToWidth(`${left}${theme.fg("dim", " · ")}${parts.right}`, width);
	return left + " ".repeat(width - leftWidth - rightWidth) + parts.right;
}

function buildFooterUsageParts(usage: FooterProviderUsage | null | undefined, headroomSegment: string | null, theme: any, thinkingLevel?: string): { left: string; windows: string[]; right?: string } | null {
	if (!usage?.windows.length) return headroomSegment ? { left: "", windows: [], right: headroomSegment } : null;
	const parts = buildUsageParts(usage, theme, thinkingLevel);
	if (headroomSegment) return { ...parts, right: headroomSegment };
	return parts;
}

function buildUsageParts(usage: FooterProviderUsage, theme: any, thinkingLevel?: string): { left: string; windows: string[] } {
	const windows: string[] = [];
	for (const window of usage.windows) {
		const remainingPercent = Math.max(0, Math.min(100, 100 - window.usedPercent));
		const pct = `${Math.round(remainingPercent)}%`;
		const reset = window.resetsIn ? ` ${window.resetsIn}` : "";
		windows.push(`${theme.fg("dim", window.label)} ${renderUsageBar(window.usedPercent, theme)} ${theme.fg("dim", pct + reset)}`);
	}
	return { left: theme.fg(getThinkingColor(thinkingLevel), usage.provider) + theme.fg("dim", " usage"), windows };
}
