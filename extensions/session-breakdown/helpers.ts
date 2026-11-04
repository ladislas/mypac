import { createReadStream } from "node:fs";
import { homedir } from "node:os";
import { basename } from "node:path";
import { createInterface } from "node:readline";
import { getSessionRoot } from "../../lib/agent-dir.ts";
import { resolveCanonicalDirectoryGroup, walkPiSessionFiles } from "../../lib/pi-session-discovery.ts";
import {
	createPiSessionParseState,
	finalizePiSessionParseState,
	parsePiSessionLine,
	parsePiSessionLines,
	parsePiSessionStartFromFilename,
	type ParsedPiSessionTelemetry,
} from "../../lib/pi-session-telemetry.ts";

export const SESSION_BREAKDOWN_RANGES = [7, 30, 90] as const;
export const DEFAULT_SESSION_ROOT = getSessionRoot();

type ModelKey = string;
type CwdKey = string;

export interface ParsedSession {
	filePath: string;
	sessionId: string | null;
	title: string | null;
	repo: string | null;
	startedAt: Date;
	dayKey: string;
	cwd: CwdKey | null;
	cwdGroup: CwdKey | null;
	modelsUsed: Set<ModelKey>;
	messages: number;
	tokens: number;
	totalCost: number;
	estimatedCost: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	inputTokens: number;
	outputTokens: number;
	contextTokensTotal: number;
	contextSamples: number;
	maxContextTokens: number;
	messagesByModel: Map<ModelKey, number>;
	tokensByModel: Map<ModelKey, number>;
	costByModel: Map<ModelKey, number>;
}

export interface CostSessionSummary {
	filePath: string;
	sessionId: string | null;
	title: string | null;
	repo: string | null;
	cwd: string | null;
	startedAt: Date;
	totalCost: number;
	estimatedCost: number;
	messages: number;
	tokens: number;
	mainModel: string | null;
}

export interface WorkflowAggregate {
	sessions: number;
	messages: number;
	tokens: number;
	totalCost: number;
}

export interface DayAggregate {
	date: Date;
	dayKey: string;
	sessions: number;
	messages: number;
	tokens: number;
	totalCost: number;
	estimatedCost: number;
}

export interface RangeAggregate {
	days: DayAggregate[];
	dayByKey: Map<string, DayAggregate>;
	sessions: number;
	totalMessages: number;
	totalTokens: number;
	totalCost: number;
	estimatedCost: number;
	modelSessions: Map<ModelKey, number>;
	modelMessages: Map<ModelKey, number>;
	modelTokens: Map<ModelKey, number>;
	modelCost: Map<ModelKey, number>;
	cwdSessions: Map<CwdKey, number>;
	cwdMessages: Map<CwdKey, number>;
	cwdTokens: Map<CwdKey, number>;
	cwdCost: Map<CwdKey, number>;
	sessionCosts: number[];
	topCostSessions: CostSessionSummary[];
	workflowStats: Map<string, WorkflowAggregate>;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	inputTokens: number;
	outputTokens: number;
	contextTokensTotal: number;
	contextSamples: number;
	maxContextTokens: number;
}

export interface SessionBreakdownReport {
	root: string;
	generatedAt: Date;
	scannedFiles: number;
	parsedSessions: number;
	unreadableFiles: number;
	skippedLines: number;
	lastError?: string;
	aborted: boolean;
	ranges: Map<number, RangeAggregate>;
	lifetimeAggregate: RangeAggregate | null;
	lifetimeOldestSessionAt: Date | null;
}

export interface AnalyzeSessionDirectoryOptions {
	root?: string;
	now?: Date;
	signal?: AbortSignal;
	lifetime?: boolean;
}

export function getDefaultSessionRoot(env: NodeJS.ProcessEnv = process.env, homeDir: string = homedir()): string {
	return getSessionRoot(env, homeDir);
}

function addToMap<K>(map: Map<K, number>, key: K, value: number): void {
	if (value === 0) return;
	map.set(key, (map.get(key) ?? 0) + value);
}

function addToWorkflowMap(map: Map<string, WorkflowAggregate>, key: string, session: ParsedSession): void {
	const current = map.get(key) ?? { sessions: 0, messages: 0, tokens: 0, totalCost: 0 };
	current.sessions += 1;
	current.messages += session.messages;
	current.tokens += session.tokens;
	current.totalCost += session.totalCost;
	map.set(key, current);
}

function getMainModel(session: ParsedSession): string | null {
	const ranked = [...session.modelsUsed].sort((a, b) => {
		const costDelta = (session.costByModel.get(b) ?? 0) - (session.costByModel.get(a) ?? 0);
		if (costDelta !== 0) return costDelta;
		const tokenDelta = (session.tokensByModel.get(b) ?? 0) - (session.tokensByModel.get(a) ?? 0);
		if (tokenDelta !== 0) return tokenDelta;
		const messageDelta = (session.messagesByModel.get(b) ?? 0) - (session.messagesByModel.get(a) ?? 0);
		return messageDelta || a.localeCompare(b);
	});
	return ranked[0] ?? null;
}

function toDayKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function localMidnight(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

function cleanTitle(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTextContent(content: unknown): string | null {
	if (typeof content === "string") return cleanTitle(content);
	if (!Array.isArray(content)) return null;
	const text = content
		.filter((part) => typeof part === "object" && part !== null && (part as { type?: unknown }).type === "text")
		.map((part) => String((part as { text?: unknown }).text ?? ""))
		.join(" ");
	return text.trim() ? cleanTitle(text) : null;
}

function safeDecodeText(text: string): string {
	try {
		return decodeURIComponent(text);
	} catch {
		return text.replace(/%20/g, " ");
	}
}

function formatIssueLink(repo: string, issueNumber: string): string {
	return `[issue #${issueNumber}](https://github.com/${repo}/issues/${issueNumber})`;
}

function repoBasename(repo: string | null): string | null {
	if (!repo) return null;
	return repo.split("/").filter(Boolean).pop() ?? null;
}

function inferGitHubRepoFromPath(path: string | null): string | null {
	if (!path) return null;
	const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
	const worktreesIndex = parts.indexOf("worktrees");
	if (worktreesIndex >= 0 && parts[worktreesIndex + 1] && parts[worktreesIndex + 2]) return `${parts[worktreesIndex + 1]}/${parts[worktreesIndex + 2]}`;
	for (let index = 0; index < parts.length - 2; index++) {
		if (parts[index] !== "dev" || parts[index + 2] === "worktrees") continue;
		const homeUser = parts[index - 2] === "Users" || parts[index - 2] === "home" ? parts[index - 1] : null;
		if (homeUser && parts[index + 1] === homeUser) return `${parts[index + 1]}/${parts[index + 2]}`;
		if (!COMMON_REPO_SUBDIRECTORIES.has(parts[index + 2])) return `${parts[index + 1]}/${parts[index + 2]}`;
	}
	return null;
}

const COMMON_REPO_SUBDIRECTORIES = new Set(["app", "apps", "bin", "docs", "examples", "lib", "packages", "scripts", "src", "test", "tests"]);

function inferDisplayRepo(session: { repo: string | null; cwd?: string | null }): string | null {
	return repoBasename(session.repo) ?? (session.cwd ? basename(session.cwd) : null);
}

function cleanupCompactSessionTitle(text: string): string {
	const decoded = safeDecodeText(cleanTitle(text));
	const issueUrl = decoded.match(/^(.*?)(?:https?:\/\/)?github\.com\/([^\s/]+)\/([^\s/]+)\/issues\/(\d+)(.*)$/i);
	if (!issueUrl) return cleanTitle(decoded);

	const prefix = cleanTitle(issueUrl[1].replace(/[-–—:]\s*$/, ""));
	const issueLabel = formatIssueLink(`${issueUrl[2]}/${issueUrl[3]}`, issueUrl[4]);
	return prefix ? `${prefix} - ${issueLabel}` : issueLabel;
}

function summarizeUserText(text: string, defaultRepo: string | null = null): string {
	const cleaned = cleanupCompactSessionTitle(text);
	if (cleaned !== cleanTitle(text)) return cleaned;

	const issueTitle = cleaned.match(/^(.*?)(?:issue|#)\s*#?(\d+)\s*[:—-]\s*([^\n.]+)/i);
	if (issueTitle?.[3]?.trim()) {
		const prefix = cleanTitle(issueTitle[1].replace(/[-–—:]\s*$/, ""));
		const label = `${defaultRepo ? formatIssueLink(defaultRepo, issueTitle[2]) : `issue #${issueTitle[2]}`} - ${cleanTitle(issueTitle[3])}`;
		return prefix ? `${prefix} - ${label}` : label;
	}

	const issueUrl = cleaned.match(/(?:https?:\/\/)?github\.com\/([^\s/]+\/[^\s/]+)\/issues\/(\d+)/i);
	if (issueUrl) return `issue #${issueUrl[2]}`;

	const issueRef = cleaned.match(/^(.*?)(?:issue\s+#?|#)(\d+)\b/i);
	if (issueRef) {
		const prefix = cleanTitle(issueRef[1].replace(/[-–—:]\s*$/, ""));
		const label = defaultRepo ? formatIssueLink(defaultRepo, issueRef[2]) : `issue #${issueRef[2]}`;
		return prefix ? `${prefix} - ${label}` : label;
	}

	return cleanTitle(cleaned.replace(/(?:https?:\/\/)?github\.com\/\S+/gi, "").replace(/\s+/g, " ")) || cleaned;
}

function humanizeSlug(value: string): string {
	return cleanTitle(
		value
			.replace(/\.jsonl$/, "")
			.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, "")
			.replace(/[._-]+/g, " "),
	);
}

function deriveFallbackTitle(state: Pick<ParsedPiSessionTelemetry, "firstUserText" | "cwd" | "filePath">): string | null {
	if (state.firstUserText) return summarizeUserText(state.firstUserText, inferGitHubRepoFromPath(state.cwd));
	if (state.cwd) return humanizeSlug(basename(state.cwd));
	const title = humanizeSlug(basename(state.filePath));
	return title || null;
}

function inferWorkflowType(session: ParsedSession): string {
	const text = basename(session.filePath).toLowerCase();
	if (/(^|[-_])(?:pac-)?llat([-_.]|$)/.test(text)) return "llat";
	if (/(^|[-_])(?:pac-)?lwot([-_.]|$)/.test(text)) return "lwot";
	if (/(^|[-_])grill([-_.]|$)/.test(text)) return "grill";
	if (/(^|[-_])review([-_.]|$)/.test(text)) return "review";
	if (/(^|[-_])triage([-_.]|$)/.test(text)) return "triage";
	if (/\b(implement|implementation|feature|bugfix|fix|commit)\b|feature[-_]|bugfix[-_]/.test(text)) return "implementation";
	return "other";
}

export function parseSessionStartFromFilename(name: string): Date | null {
	return parsePiSessionStartFromFilename(name);
}

function toBreakdownSession(state: ParsedPiSessionTelemetry): ParsedSession | null {
	if (!state.startedAt) return null;
	const repo = inferGitHubRepoFromPath(state.cwd);
	return {
		filePath: state.filePath,
		sessionId: state.sessionId,
		title: state.name ? summarizeUserText(state.name, repo) : deriveFallbackTitle(state),
		repo,
		startedAt: state.startedAt,
		dayKey: toDayKey(state.startedAt),
		cwd: state.cwd,
		cwdGroup: state.cwd,
		modelsUsed: state.modelsUsed,
		messages: state.messages,
		tokens: state.tokens,
		totalCost: state.totalCost,
		estimatedCost: state.estimatedCost,
		cacheReadTokens: state.cacheReadTokens,
		cacheWriteTokens: state.cacheWriteTokens,
		inputTokens: state.inputTokens,
		outputTokens: state.outputTokens,
		contextTokensTotal: state.contextTokensTotal,
		contextSamples: state.contextSamples,
		maxContextTokens: state.maxContextTokens,
		messagesByModel: state.messagesByModel,
		tokensByModel: state.tokensByModel,
		costByModel: state.costByModel,
	};
}

export function parseSessionLines(content: string, filePath = "session.jsonl"): ParsedSession | null {
	return toBreakdownSession(parsePiSessionLines(content, filePath));
}

async function parseSessionFile(filePath: string, signal?: AbortSignal): Promise<{ session: ParsedSession | null; skippedLines: number; error?: string }> {
	const state = createPiSessionParseState(filePath);
	const stream = createReadStream(filePath, { encoding: "utf8" });
	const reader = createInterface({ input: stream, crlfDelay: Infinity });
	try {
		for await (const line of reader) {
			if (signal?.aborted) return { session: null, skippedLines: state.skippedLines };
			parsePiSessionLine(state, line);
		}
		const session = toBreakdownSession(finalizePiSessionParseState(state));
		if (session?.cwd) {
			try {
				session.cwdGroup = await resolveCanonicalDirectoryGroup(session.cwd);
			} catch {
				session.cwdGroup = session.cwd;
			}
		}
		return { session, skippedLines: state.skippedLines };
	} catch {
		return { session: null, skippedLines: state.skippedLines, error: `Could not read ${basename(filePath)}` };
	} finally {
		reader.close();
		stream.destroy();
	}
}

function createRangeAggregate(days: number, now: Date): RangeAggregate {
	const end = localMidnight(now);
	const start = addDays(end, -(days - 1));
	const dayList: DayAggregate[] = [];
	const dayByKey = new Map<string, DayAggregate>();
	for (let index = 0; index < days; index++) {
		const date = addDays(start, index);
		const dayKey = toDayKey(date);
		const aggregate = { date, dayKey, sessions: 0, messages: 0, tokens: 0, totalCost: 0, estimatedCost: 0 };
		dayList.push(aggregate);
		dayByKey.set(dayKey, aggregate);
	}
	return {
		days: dayList,
		dayByKey,
		sessions: 0,
		totalMessages: 0,
		totalTokens: 0,
		totalCost: 0,
		estimatedCost: 0,
		modelSessions: new Map(),
		modelMessages: new Map(),
		modelTokens: new Map(),
		modelCost: new Map(),
		cwdSessions: new Map(),
		cwdMessages: new Map(),
		cwdTokens: new Map(),
		cwdCost: new Map(),
		sessionCosts: [],
		topCostSessions: [],
		workflowStats: new Map(),
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		inputTokens: 0,
		outputTokens: 0,
		contextTokensTotal: 0,
		contextSamples: 0,
		maxContextTokens: 0,
	};
}

function createLifetimeAggregate(): RangeAggregate {
	return {
		days: [],
		dayByKey: new Map(),
		sessions: 0,
		totalMessages: 0,
		totalTokens: 0,
		totalCost: 0,
		estimatedCost: 0,
		modelSessions: new Map(),
		modelMessages: new Map(),
		modelTokens: new Map(),
		modelCost: new Map(),
		cwdSessions: new Map(),
		cwdMessages: new Map(),
		cwdTokens: new Map(),
		cwdCost: new Map(),
		sessionCosts: [],
		topCostSessions: [],
		workflowStats: new Map(),
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		inputTokens: 0,
		outputTokens: 0,
		contextTokensTotal: 0,
		contextSamples: 0,
		maxContextTokens: 0,
	};
}

function addSessionCore(range: RangeAggregate, session: ParsedSession): void {
	range.sessions += 1;
	range.totalMessages += session.messages;
	range.totalTokens += session.tokens;
	range.totalCost += session.totalCost;
	range.estimatedCost += session.estimatedCost;
	range.cacheReadTokens += session.cacheReadTokens;
	range.cacheWriteTokens += session.cacheWriteTokens;
	range.inputTokens += session.inputTokens;
	range.outputTokens += session.outputTokens;
	range.contextTokensTotal += session.contextTokensTotal;
	range.contextSamples += session.contextSamples;
	range.maxContextTokens = Math.max(range.maxContextTokens, session.maxContextTokens);
	range.sessionCosts.push(session.totalCost);
	if (session.totalCost > 0) {
		range.topCostSessions.push({
			filePath: session.filePath,
			sessionId: session.sessionId,
			title: session.title,
			repo: session.repo,
			cwd: session.cwd,
			startedAt: session.startedAt,
			totalCost: session.totalCost,
			estimatedCost: session.estimatedCost,
			messages: session.messages,
			tokens: session.tokens,
			mainModel: getMainModel(session),
		});
		range.topCostSessions.sort((a, b) => b.totalCost - a.totalCost || a.filePath.localeCompare(b.filePath));
		range.topCostSessions = range.topCostSessions.slice(0, 5);
	}
	addToWorkflowMap(range.workflowStats, inferWorkflowType(session), session);
	for (const model of session.modelsUsed) addToMap(range.modelSessions, model, 1);
	for (const [model, count] of session.messagesByModel) addToMap(range.modelMessages, model, count);
	for (const [model, count] of session.tokensByModel) addToMap(range.modelTokens, model, count);
	for (const [model, count] of session.costByModel) addToMap(range.modelCost, model, count);
	const cwdGroup = session.cwdGroup ?? session.cwd;
	if (cwdGroup) {
		addToMap(range.cwdSessions, cwdGroup, 1);
		addToMap(range.cwdMessages, cwdGroup, session.messages);
		addToMap(range.cwdTokens, cwdGroup, session.tokens);
		addToMap(range.cwdCost, cwdGroup, session.totalCost);
	}
}

function addSessionUnconstrained(range: RangeAggregate, session: ParsedSession): void {
	addSessionCore(range, session);
}

function addSession(range: RangeAggregate, session: ParsedSession): void {
	const day = range.dayByKey.get(session.dayKey);
	if (!day) return;
	addSessionCore(range, session);
	day.sessions += 1;
	day.messages += session.messages;
	day.tokens += session.tokens;
	day.totalCost += session.totalCost;
	day.estimatedCost += session.estimatedCost;
}


export async function analyzeSessionDirectory(options: AnalyzeSessionDirectoryOptions = {}): Promise<SessionBreakdownReport> {
	const root = options.root ?? DEFAULT_SESSION_ROOT;
	const now = options.now ?? new Date();
	const isLifetime = options.lifetime === true;
	const maxRangeDays = Math.max(...SESSION_BREAKDOWN_RANGES);
	const cutoff = isLifetime ? undefined : addDays(localMidnight(now), -(maxRangeDays - 1));
	const scanned = await walkPiSessionFiles(root, cutoff, options.signal);
	const ranges = new Map<number, RangeAggregate>();
	for (const days of SESSION_BREAKDOWN_RANGES) ranges.set(days, createRangeAggregate(days, now));

	const lifetimeAggregate = isLifetime ? createLifetimeAggregate() : null;
	let lifetimeOldestSessionAt: Date | null = null;

	let parsedSessions = 0;
	let unreadableFiles = scanned.unreadableFiles;
	let skippedLines = 0;
	let lastError = scanned.lastError;
	for (const file of scanned.files.sort()) {
		if (options.signal?.aborted) break;
		const { session, skippedLines: fileSkippedLines, error } = await parseSessionFile(file, options.signal);
		skippedLines += fileSkippedLines;
		if (error) {
			unreadableFiles += 1;
			lastError = error;
		}
		if (!session) continue;
		parsedSessions += 1;
		for (const range of ranges.values()) addSession(range, session);
		if (lifetimeAggregate) {
			addSessionUnconstrained(lifetimeAggregate, session);
			if (!lifetimeOldestSessionAt || session.startedAt < lifetimeOldestSessionAt) {
				lifetimeOldestSessionAt = session.startedAt;
			}
		}
	}

	return {
		root,
		generatedAt: now,
		scannedFiles: scanned.files.length,
		parsedSessions,
		unreadableFiles,
		skippedLines,
		lastError,
		aborted: options.signal?.aborted ?? false,
		ranges,
		lifetimeAggregate,
		lifetimeOldestSessionAt,
	};
}

function formatNumber(value: number): string {
	if (!Number.isFinite(value) || value === 0) return "0";
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
	if (value >= 10_000) return `${(value / 1_000).toFixed(1)}k`;
	return Math.round(value).toLocaleString("en-US");
}

function formatCost(value: number): string {
	if (!Number.isFinite(value) || value === 0) return "$0";
	if (value >= 1) return `$${value.toFixed(2)}`;
	return `$${value.toFixed(4)}`;
}

function formatCostFixed(value: number): string {
	if (!Number.isFinite(value)) return "$0.00";
	return `$${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return "0.0%";
	return `${(value * 100).toFixed(1)}%`;
}

function formatDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function sortMap(map: Map<string, number>): Array<[string, number]> {
	return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

type ColorName = "bold" | "dim" | "blue" | "cyan" | "yellow" | "red";

const ANSI: Record<ColorName, [string, string]> = {
	bold: ["\u001b[1m", "\u001b[22m"],
	dim: ["\u001b[2m", "\u001b[22m"],
	blue: ["\u001b[34m", "\u001b[39m"],
	cyan: ["\u001b[36m", "\u001b[39m"],
	yellow: ["\u001b[33m", "\u001b[39m"],
	red: ["\u001b[31m", "\u001b[39m"],
};

function colorize(text: string, color: ColorName, enabled: boolean): string {
	if (!enabled) return text;
	const [open, close] = ANSI[color];
	return `${open}${text}${close}`;
}

function padCell(value: string, width: number): string {
	return value.length >= width ? value : `${value}${" ".repeat(width - value.length)}`;
}

function visibleLength(value: string): number {
	return value
		.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
		.replace(/\u001b\[[0-9;]*m/g, "")
		.length;
}

function fitCell(value: string, width: number): string {
	const length = visibleLength(value);
	if (length <= width) return `${value}${" ".repeat(width - length)}`;
	if (width <= 1) return "…";
	return `${truncateToVisibleLength(value, width - 1)}…`;
}

function truncateToVisibleLength(value: string, maxVisibleLength: number): string {
	let result = "";
	let index = 0;
	let visible = 0;
	while (index < value.length && visible < maxVisibleLength) {
		const ansi = value.slice(index).match(/^\u001b\[[0-9;]*m/);
		if (ansi) {
			result += ansi[0];
			index += ansi[0].length;
			continue;
		}

		const link = value.slice(index).match(/^\[([^\]]+)\]\(([^)]+)\)/);
		if (link) {
			const label = link[1];
			const remaining = maxVisibleLength - visible;
			if (label.length <= remaining) {
				result += link[0];
				visible += label.length;
			} else {
				result += label.slice(0, remaining);
				visible = maxVisibleLength;
			}
			index += link[0].length;
			continue;
		}

		result += value[index];
		index += 1;
		visible += 1;
	}
	return result;
}

function stripMarkdownLinks(value: string): string {
	return value.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
}

function compactCell(value: string, width: number): string {
	return fitCell(stripMarkdownLinks(value), width);
}

function formatRatio(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return "0×";
	return `${value.toFixed(1)}×`;
}

function formatCostPerMessage(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return "$0";
	return `$${value.toFixed(4)}`;
}

function formatCostPerMillionTokens(cost: number, tokens: number): string {
	if (!Number.isFinite(cost) || !Number.isFinite(tokens) || tokens <= 0) return "$0";
	return `$${((cost / tokens) * 1_000_000).toFixed(2)}`;
}

function cacheHealth(leverage: number): string | null {
	if (!Number.isFinite(leverage) || leverage <= 0) return null;
	if (leverage >= 50) return "excellent reuse";
	if (leverage >= 10) return "good reuse";
	if (leverage >= 3) return "moderate reuse";
	return "low reuse";
}

function formatOverviewRow(label: string, range: RangeAggregate): string {
	const cells = [
		fitCell(label, 7),
		fitCell(formatNumber(range.sessions), 8),
		fitCell(formatNumber(range.totalMessages), 8),
		fitCell(formatNumber(range.totalTokens), 8),
		fitCell(formatCost(range.totalCost), 8),
		fitCell(formatCost(range.totalCost / Number(label.replace("d", ""))), 8),
	];
	return `│ ${cells.join(" │ ")} │`;
}

function renderBar(value: number, maxValue: number, width = 28): string {
	if (value <= 0 || maxValue <= 0) return "".padEnd(width);
	const filled = Math.max(1, Math.round((value / maxValue) * width));
	return "█".repeat(filled).padEnd(width);
}

function formatCostBars(
	title: string,
	costs: Map<string, number>,
	totalCost: number,
	options: { homeDir?: string; color: boolean; transformKey?: (key: string) => string },
): string[] {
	const rows = sortMap(costs).slice(0, 3);
	if (rows.length === 0) return [colorize(title, "bold", options.color), "  none"];
	const maxCost = rows[0]?.[1] ?? 0;
	return [
		colorize(title, "bold", options.color),
		...rows.map(([key, cost]) => {
			const displayKey = options.transformKey ? options.transformKey(key) : key;
			const share = totalCost > 0 ? cost / totalCost : 0;
			return `${colorize(fitCell(displayKey, 44), "blue", options.color)} ${padCell(formatCost(cost), 8)} ${colorize(renderBar(cost, maxCost), "cyan", options.color)} ${formatPercent(share)}`;
		}),
	];
}

function buildInsights(report: SessionBreakdownReport): string[] {
	const seven = report.ranges.get(7);
	const thirty = report.ranges.get(30);
	const ninety = report.ranges.get(90);
	if (!seven) return ["No session cost data found in the selected 90 day window."];

	const insights: string[] = [];
	if (seven.totalCost > 0) insights.push(`⚠️  Current pace projects to ~$${Math.round((seven.totalCost / 7) * 30).toLocaleString("en-US")}/month.`);
	if (seven.totalCost > 0 && thirty && thirty.totalCost > 0) {
		const ratio = seven.totalCost / 7 / (thirty.totalCost / 30);
		if (ratio >= 1.5) insights.push(`🔥 Usage is accelerating: 7d daily cost is ${ratio.toFixed(1)}× the 30d average.`);
	}
	if (seven.totalCost > 0) {
		const topCost = seven.topCostSessions.reduce((sum, session) => sum + session.totalCost, 0);
		if (topCost > 0) insights.push(`🎯 Top ${seven.topCostSessions.length} sessions account for ${formatPercent(topCost / seven.totalCost)} of 7d cost.`);
	}
	if (seven.totalCost > 0 && ninety && ninety.totalCost > 0) insights.push(`📈 Last 7d already represents ${formatPercent(seven.totalCost / ninety.totalCost)} of 90d spend.`);
	return insights.length > 0 ? insights : ["No paid usage found in the selected 90 day window."];
}

function hasEstimatedCosts(report: SessionBreakdownReport): boolean {
	if ((report.lifetimeAggregate?.estimatedCost ?? 0) > 0) return true;
	return [...report.ranges.values()].some((range) => range.estimatedCost > 0);
}

function formatEstimatedCostNote(report: SessionBreakdownReport): string | null {
	return hasEstimatedCosts(report)
		? "Cost note: API-equivalent token value includes catalog or market estimates, not subscription charges or an invoice; historical costs may have unknown provenance."
		: "Cost note: API-equivalent token value where priced, not subscription charges or an invoice; unpriced provider and historical costs may have unknown provenance.";
}

function compactBranchName(name: string): string | null {
	const parts = name.split(/[-_]+/).filter(Boolean);
	const typeIndex = parts.findIndex((part, index) => ["feature", "bugfix", "release"].includes(part) && /^\d+$/.test(parts[index + 1] ?? ""));
	if (typeIndex === -1) return null;
	const prefix = parts.slice(typeIndex, typeIndex + 2);
	const stopWords = new Set(["add", "agent", "stuff", "usage", "stats", "for", "from", "with", "investigate", "implement", "implementation", "improve", "improvements"]);
	const topic = parts.slice(typeIndex + 2).filter((part) => !stopWords.has(part));
	return [...prefix, ...topic.slice(-3)].join("-");
}

function compactPathLabel(path: string, homeDir: string | undefined, maxLength = 44): string {
	const display = abbreviatePath(path, homeDir, maxLength);
	if (display.length <= maxLength) return display;
	const branchName = compactBranchName(basename(path));
	if (branchName) return abbreviatePath(`~/worktrees/${branchName}`, "~", maxLength).replace(/^~\/worktrees\//, "~/…/");
	return fitCell(display, maxLength).trimEnd();
}

function formatShortSessionId(id: string | null): string {
	if (!id) return "unknown";
	return id.length <= 16 ? id : `${id.slice(0, 8)}…${id.slice(-6)}`;
}

function formatCompactModelName(model: string | null): string {
	if (!model) return "unknown";
	const name = model.split("/").pop() ?? model;
	return name.replace(/^claude-/, "");
}

function normalizeTitleForRepo(title: string, repo: string | null): string {
	const repoName = repoBasename(repo);
	let normalized = title;
	if (repo) normalized = normalized.replace(new RegExp(`^${escapeRegExp(repo)}\\s+`, "i"), "");
	if (repoName) normalized = normalized.replace(new RegExp(`^${escapeRegExp(repoName)}\\s+`, "i"), "");
	return cleanTitle(normalized.replace(/^[-–—:·]\s*/, ""));
}

function compactSessionTitle(session: CostSessionSummary, width: number): string {
	const title = normalizeTitleForRepo(session.title ?? humanizeSlug(basename(session.filePath)), session.repo);
	const repo = inferDisplayRepo(session);
	const display = repo ? `${repo} · ${title}` : title;
	return fitCell(display, width).trimEnd();
}

function formatOutlierSummary(range: RangeAggregate, options: { homeDir?: string; color: boolean; costCenterRange?: RangeAggregate }): string[] {
	const lines = [colorize("Outliers · 7d", "bold", options.color)];
	const mostExpensive = range.topCostSessions[0];
	if (!mostExpensive) return [...lines, "  none"];
	const topFiveCost = range.topCostSessions.slice(0, 5).reduce((sum, session) => sum + session.totalCost, 0);
	const costCenterRange = options.costCenterRange;
	const mainCostCenter = costCenterRange ? sortMap(costCenterRange.cwdCost)[0] : undefined;
	lines.push(
		` ${colorize("🔴", "red", options.color)} Most expensive session: ${formatCost(mostExpensive.totalCost)} · ${formatShortSessionId(mostExpensive.sessionId)} · ${compactSessionTitle(mostExpensive, 56)}`,
		` 🎯 Top ${Math.min(5, range.topCostSessions.length)} sessions: ${formatCost(topFiveCost)} · ${formatPercent(range.totalCost > 0 ? topFiveCost / range.totalCost : 0)} of 7d cost`,
	);
	if (mainCostCenter && costCenterRange && costCenterRange.totalCost > 0) {
		const [cwd, cost] = mainCostCenter;
		lines.push(
			` 🧱 Main cost center: ${compactPathLabel(cwd, options.homeDir, 42)} · ${formatPercent(cost / costCenterRange.totalCost)} of 30d spend`,
		);
	}
	return lines;
}

function formatSessionDrillDown(range: RangeAggregate, color: boolean, label = "Session drill-down · 7d · top 5 by cost"): string[] {
	const lines = [colorize(label, "bold", color)];
	if (range.topCostSessions.length === 0) return [...lines, "  none"];
	lines.push(`${padCell("Cost", 7)} ${padCell("Date", 10)} ${padCell("ID", 16)} ${padCell("Msgs", 5)} ${padCell("Tokens", 7)} ${padCell("Main model", 24)} Title`);
	for (const session of range.topCostSessions.slice(0, 5)) {
		lines.push(
			`${padCell(formatCost(session.totalCost), 7)} ${formatDate(session.startedAt)} ${padCell(formatShortSessionId(session.sessionId), 16)} ${padCell(formatNumber(session.messages), 5)} ${padCell(formatNumber(session.tokens), 7)} ${compactCell(formatCompactModelName(session.mainModel), 24)} ${compactSessionTitle(session, 36)}`,
		);
	}
	return lines;
}

function formatModelDrillDown(range: RangeAggregate, color: boolean, label = "Model drill-down · 30d · top 5 by cost"): string[] {
	const rows = sortMap(range.modelCost).slice(0, 5);
	const modelWidth = 32;
	const lines = [colorize(label, "bold", color)];
	if (rows.length === 0) return [...lines, "  none"];
	lines.push(`${padCell("Model", modelWidth)} ${padCell("Sessions", 8)} ${padCell("Msgs", 6)} ${padCell("Tokens", 8)} ${padCell("Cost", 8)} ${padCell("$/msg", 8)} $/1M tok`);
	for (const [model, cost] of rows) {
		const sessions = range.modelSessions.get(model) ?? 0;
		const messages = range.modelMessages.get(model) ?? 0;
		const tokens = range.modelTokens.get(model) ?? 0;
		lines.push(
			`${compactCell(model, modelWidth)} ${padCell(formatNumber(sessions), 8)} ${padCell(formatNumber(messages), 6)} ${padCell(formatNumber(tokens), 8)} ${padCell(formatCost(cost), 8)} ${padCell(formatCostPerMessage(messages ? cost / messages : 0), 8)} ${formatCostPerMillionTokens(cost, tokens)}`,
		);
	}
	return lines;
}

function formatDirectoryDrillDown(range: RangeAggregate, options: { homeDir?: string; color: boolean; label?: string }): string[] {
	const rows = sortMap(range.cwdCost).slice(0, 5);
	const lines = [colorize(options.label ?? "Directory drill-down · 30d · top 5 by cost", "bold", options.color)];
	if (rows.length === 0) return [...lines, "  none"];
	const overallAverage = range.sessions ? range.totalCost / range.sessions : 0;
	lines.push(`${padCell("Directory", 44)} ${padCell("Sessions", 8)} ${padCell("Msgs", 6)} ${padCell("Tokens", 8)} ${padCell("Cost", 8)} Avg/session`);
	for (const [cwd, cost] of rows) {
		const sessions = range.cwdSessions.get(cwd) ?? 0;
		const messages = range.cwdMessages.get(cwd) ?? 0;
		const tokens = range.cwdTokens.get(cwd) ?? 0;
		const averageCost = sessions ? cost / sessions : 0;
		const warning = overallAverage > 0 && averageCost >= overallAverage * 2 ? ` ${colorize("🔴", "red", options.color)}` : "";
		lines.push(
			`${compactCell(compactPathLabel(cwd, options.homeDir, 44), 44)} ${padCell(formatNumber(sessions), 8)} ${padCell(formatNumber(messages), 6)} ${padCell(formatNumber(tokens), 8)} ${padCell(formatCost(cost), 8)} ${formatCostFixed(averageCost)}${warning}`,
		);
	}
	return lines;
}

function formatCacheContext(range: RangeAggregate, color: boolean): string[] {
	const lines = [colorize("Cache / context · 7d", "bold", color)];
	if (range.cacheReadTokens > 0 || range.cacheWriteTokens > 0) {
		lines.push(`Cache read/write   ${formatNumber(range.cacheReadTokens)} / ${formatNumber(range.cacheWriteTokens)} tokens`);
		if (range.cacheWriteTokens > 0) {
			const leverage = range.cacheReadTokens / range.cacheWriteTokens;
			lines.push(`Cache leverage     ${formatRatio(leverage)} read per write`);
			const health = cacheHealth(leverage);
			if (health) lines.push(`Cache health       ${health}`);
		}
	}
	if (range.contextSamples > 0 && range.maxContextTokens > 0) {
		const averageContext = range.contextTokensTotal / range.contextSamples;
		lines.push(`Avg context        ${formatNumber(averageContext)} / ${formatNumber(range.maxContextTokens)}`);
		lines.push(`Context pressure   ${Math.round((averageContext / range.maxContextTokens) * 100)}%`);
	}
	if (range.inputTokens > 0 && range.outputTokens > 0) lines.push(`Input/output       ${formatRatio(range.inputTokens / range.outputTokens)}`);
	return lines.length > 1 ? lines : [];
}

export function abbreviatePath(path: string, homeDir = homedir(), maxLength = 48): string {
	const normalizedPath = path.replace(/\\/g, "/");
	const normalizedHome = homeDir.replace(/\\/g, "/");
	const isUnderHome = normalizedPath === normalizedHome || normalizedPath.startsWith(`${normalizedHome}/`);
	let display = isUnderHome ? `~${normalizedPath.slice(normalizedHome.length)}` : normalizedPath;
	if (display.length <= maxLength) return display;
	const parts = display.split("/").filter(Boolean);
	if (parts.length <= 2) return display;
	const first = display.startsWith("/") ? `/${parts[0]}` : parts[0];
	for (let keep = Math.min(parts.length - 1, 4); keep >= 1; keep--) {
		const candidate = `${first}/…/${parts.slice(-keep).join("/")}`;
		if (candidate.length <= maxLength || keep === 1) return candidate;
	}
	return display;
}

function formatTopMap(title: string, map: Map<string, number>, formatter: (value: number) => string, transformKey = (key: string) => key): string[] {
	const rows = sortMap(map).slice(0, 5);
	if (rows.length === 0) return [`  ${title}: none`];
	return [`  ${title}:`, ...rows.map(([key, value]) => `    - ${transformKey(key)}: ${formatter(value)}`)];
}

function formatOptionalTopMap(title: string, map: Map<string, number>, formatter: (value: number) => string, transformKey = (key: string) => key): string[] {
	return map.size > 0 ? formatTopMap(title, map, formatter, transformKey) : [];
}

function formatCostDistribution(costs: number[]): string {
	if (costs.length === 0) return "  cost distribution: none";
	let sum = 0;
	let max = 0;
	for (const cost of costs) {
		sum += cost;
		if (cost > max) max = cost;
	}
	const sorted = [...costs].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	const medianCost = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
	const p90Index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(0.9 * sorted.length) - 1));
	return `  cost distribution: avg/session ${formatCost(sum / costs.length)} · median ${formatCost(medianCost)} · p90 ${formatCost(sorted[p90Index])} · max ${formatCost(max)}`;
}

function formatTopCostSessions(sessions: CostSessionSummary[], homeDir?: string): string[] {
	if (sessions.length === 0) return ["  top expensive sessions: none"];
	return [
		"  top expensive sessions:",
		...sessions.map((session) => `    - ${formatDate(session.startedAt)} · ${abbreviatePath(session.filePath, homeDir, 64)}: ${formatCost(session.totalCost)}`),
	];
}

function formatCostByWorkflow(map: Map<string, WorkflowAggregate>): string[] {
	const rows = [...map.entries()].sort((a, b) => b[1].totalCost - a[1].totalCost || a[0].localeCompare(b[0])).slice(0, 5);
	if (rows.length === 0) return ["  cost by workflow type: none"];
	return [
		"  cost by workflow type:",
		...rows.map(
			([key, value]) =>
				`    - ${key}: ${formatCost(value.totalCost)} · avg/session ${formatCost(value.totalCost / value.sessions)} · sessions ${formatNumber(value.sessions)} · messages ${formatNumber(value.messages)} · tokens ${formatNumber(value.tokens)}`,
		),
	];
}

function formatCostMapWithAverages(
	title: string,
	costs: Map<string, number>,
	messages: Map<string, number>,
	sessions: Map<string, number>,
	transformKey = (key: string) => key,
): string[] {
	const rows = sortMap(costs).slice(0, 5);
	if (rows.length === 0) return [];
	return [
		`  ${title}:`,
		...rows.map(([key, cost]) => {
			const messageCount = messages.get(key) ?? 0;
			const sessionCount = sessions.get(key) ?? 0;
			return `    - ${transformKey(key)}: ${formatCost(cost)} · avg/message ${formatCost(messageCount ? cost / messageCount : 0)} · avg/session ${formatCost(sessionCount ? cost / sessionCount : 0)}`;
		}),
	];
}

export function formatBreakdownReport(report: SessionBreakdownReport, options: { homeDir?: string } = {}): string {
	const lines = [
		"Pi session breakdown",
		`Source: ${abbreviatePath(report.root, options.homeDir)}`,
		"Privacy: local aggregate stats only; raw prompts, responses, and tool contents are not printed.",
		`Scanned ${report.scannedFiles} file(s); parsed ${report.parsedSessions} session(s).`,
	];

	if (report.scannedFiles === 0) lines.push("No session files found in the selected 90 day window.");
	else if (report.parsedSessions === 0) lines.push("No parseable session files found in the selected 90 day window.");
	if (report.unreadableFiles > 0 || report.skippedLines > 0) {
		const parts = [];
		if (report.unreadableFiles > 0) parts.push(`${report.unreadableFiles} unreadable file(s)`);
		if (report.skippedLines > 0) parts.push(`${report.skippedLines} malformed JSONL line(s)`);
		lines.push(`Warning: skipped ${parts.join(" and ")}.${report.lastError ? ` Last error: ${report.lastError}.` : ""}`);
	}
	const costNote = formatEstimatedCostNote(report);
	if (costNote) lines.push(costNote);

	for (const days of SESSION_BREAKDOWN_RANGES) {
		const range = report.ranges.get(days);
		if (!range) continue;
		lines.push("", `Last ${days} days`);
		lines.push(
			`  sessions: ${formatNumber(range.sessions)} · messages: ${formatNumber(range.totalMessages)} · tokens: ${formatNumber(range.totalTokens)} · cost: ${formatCost(range.totalCost)}`,
		);
		lines.push(formatCostDistribution(range.sessionCosts));
		lines.push(...formatTopCostSessions(range.topCostSessions, options.homeDir));
		lines.push(...formatCostByWorkflow(range.workflowStats));
		lines.push(...formatTopMap("sessions by model", range.modelSessions, formatNumber));
		lines.push(...formatTopMap("messages by model", range.modelMessages, formatNumber));
		lines.push(...formatOptionalTopMap("tokens by model", range.modelTokens, formatNumber));
		lines.push(...formatCostMapWithAverages("cost by model", range.modelCost, range.modelMessages, range.modelSessions));
		lines.push(...formatTopMap("sessions by directory", range.cwdSessions, formatNumber, (key) => abbreviatePath(key, options.homeDir)));
		lines.push(...formatTopMap("messages by directory", range.cwdMessages, formatNumber, (key) => abbreviatePath(key, options.homeDir)));
		lines.push(...formatOptionalTopMap("tokens by directory", range.cwdTokens, formatNumber, (key) => abbreviatePath(key, options.homeDir)));
		lines.push(...formatCostMapWithAverages("cost by directory", range.cwdCost, range.cwdMessages, range.cwdSessions, (key) => abbreviatePath(key, options.homeDir)));
	}

	return lines.join("\n");
}

export function formatCompactBreakdownReport(report: SessionBreakdownReport, options: { homeDir?: string; color?: boolean } = {}): string {
	const color = options.color ?? true;
	const seven = report.ranges.get(7);
	const thirty = report.ranges.get(30);
	const ninety = report.ranges.get(90);
	const lines = [
		colorize("Pi session breakdown", "bold", color),
		`${colorize("Source:", "dim", color)} ${abbreviatePath(report.root, options.homeDir)}`,
		`Local aggregate stats only · ${formatNumber(report.parsedSessions)} sessions parsed`,
	];

	if (report.unreadableFiles > 0 || report.skippedLines > 0) {
		const parts = [];
		if (report.unreadableFiles > 0) parts.push(`${report.unreadableFiles} unreadable file(s)`);
		if (report.skippedLines > 0) parts.push(`${report.skippedLines} malformed JSONL line(s)`);
		lines.push(colorize(`Warning: skipped ${parts.join(" and ")}.${report.lastError ? ` Last error: ${report.lastError}.` : ""}`, "yellow", color));
	}
	const costNote = formatEstimatedCostNote(report);
	if (costNote) lines.push(colorize(costNote, "dim", color));

	lines.push(
		"",
		colorize("Overview", "bold", color),
		"┌─────────┬──────────┬──────────┬──────────┬──────────┬──────────┐",
		"│ Window  │ Sessions │ Messages │ Tokens   │ Cost     │ Daily avg│",
		"├─────────┼──────────┼──────────┼──────────┼──────────┼──────────┤",
	);
	if (seven) lines.push(formatOverviewRow("7d", seven));
	if (thirty) lines.push(formatOverviewRow("30d", thirty));
	if (ninety) lines.push(formatOverviewRow("90d", ninety));
	lines.push("└─────────┴──────────┴──────────┴──────────┴──────────┴──────────┘");

	lines.push("", colorize("Insights", "bold", color), ...buildInsights(report).map((line) => `  ${line}`));

	if (thirty) {
		lines.push(
			"",
			...formatCostBars("Cost by model · 30d spend share", thirty.modelCost, thirty.totalCost, { color }),
			"",
			...formatCostBars("Cost by directory · 30d spend share", thirty.cwdCost, thirty.totalCost, {
				color,
				transformKey: (key) => compactPathLabel(key, options.homeDir, 44),
			}),
		);
	}

	if (seven) lines.push("", ...formatOutlierSummary(seven, { homeDir: options.homeDir, color, costCenterRange: thirty }));
	else lines.push("", colorize("Outliers · 7d", "bold", color), "  none");

	if (seven) lines.push("", ...formatSessionDrillDown(seven, color));
	if (thirty) {
		lines.push("", ...formatModelDrillDown(thirty, color), "", ...formatDirectoryDrillDown(thirty, { homeDir: options.homeDir, color }));
	}
	if (seven) {
		const cacheContext = formatCacheContext(seven, color);
		if (cacheContext.length > 0) lines.push("", ...cacheContext);
	}
	return lines.join("\n");
}

function buildLifetimeInsights(report: SessionBreakdownReport): string[] {
	const lifetime = report.lifetimeAggregate;
	if (!lifetime || lifetime.totalCost === 0) return ["No paid usage found in lifetime sessions."];

	const seven = report.ranges.get(7);
	const thirty = report.ranges.get(30);
	const ninety = report.ranges.get(90);

	const insights: string[] = [];
	if (seven && seven.totalCost > 0) {
		insights.push(`📅 Last 7d represents ${formatPercent(seven.totalCost / lifetime.totalCost)} of lifetime spend (${formatCost(seven.totalCost)})`);
	}
	if (thirty && thirty.totalCost > 0) {
		insights.push(`📅 Last 30d represents ${formatPercent(thirty.totalCost / lifetime.totalCost)} of lifetime spend (${formatCost(thirty.totalCost)})`);
	}
	if (ninety && ninety.totalCost > 0) {
		insights.push(`📅 Last 90d represents ${formatPercent(ninety.totalCost / lifetime.totalCost)} of lifetime spend (${formatCost(ninety.totalCost)})`);
	}
	const topWorkflow = [...lifetime.workflowStats.entries()].sort((a, b) => b[1].totalCost - a[1].totalCost || a[0].localeCompare(b[0]))[0];
	if (topWorkflow && lifetime.totalCost > 0) {
		insights.push(`🏆 Top workflow: ${topWorkflow[0]} · ${formatCost(topWorkflow[1].totalCost)} · ${formatPercent(topWorkflow[1].totalCost / lifetime.totalCost)} of lifetime`);
	}
	return insights.length > 0 ? insights : ["No relative comparisons available."];
}

export function formatLifetimeReport(report: SessionBreakdownReport, options: { homeDir?: string; color?: boolean } = {}): string {
	const color = options.color ?? true;
	const lifetime = report.lifetimeAggregate;
	if (!lifetime) return "No lifetime data available. Run with the 'lifetime' argument.";

	const lines = [
		colorize("Pi session breakdown · Lifetime", "bold", color),
		`${colorize("Source:", "dim", color)} ${abbreviatePath(report.root, options.homeDir)}`,
		`Local aggregate stats only · ${formatNumber(report.parsedSessions)} sessions scanned (all time)`,
	];

	if (report.unreadableFiles > 0 || report.skippedLines > 0) {
		const parts = [];
		if (report.unreadableFiles > 0) parts.push(`${report.unreadableFiles} unreadable file(s)`);
		if (report.skippedLines > 0) parts.push(`${report.skippedLines} malformed JSONL line(s)`);
		lines.push(colorize(`Warning: skipped ${parts.join(" and ")}.${report.lastError ? ` Last error: ${report.lastError}.` : ""}`, "yellow", color));
	}
	const costNote = formatEstimatedCostNote(report);
	if (costNote) lines.push(colorize(costNote, "dim", color));

	lines.push("", colorize("Lifetime totals", "bold", color));
	lines.push(`  Sessions:   ${formatNumber(lifetime.sessions)}`);
	lines.push(`  Messages:   ${formatNumber(lifetime.totalMessages)}`);
	lines.push(`  Tokens:     ${formatNumber(lifetime.totalTokens)}`);
	lines.push(`  Cost:       ${formatCost(lifetime.totalCost)}`);
	if (lifetime.sessions > 0) {
		lines.push(`  Avg/session: ${formatCost(lifetime.totalCost / lifetime.sessions)}`);
	}
	if (report.lifetimeOldestSessionAt) {
		const daySpan = Math.max(1, Math.round((report.generatedAt.getTime() - report.lifetimeOldestSessionAt.getTime()) / (1000 * 60 * 60 * 24)));
		lines.push(`  Avg/day:    ${formatCost(lifetime.totalCost / daySpan)} (over ${daySpan.toLocaleString("en-US")}d since ${formatDate(report.lifetimeOldestSessionAt)})`);
	}

	lines.push("", colorize("Relative insights", "bold", color), ...buildLifetimeInsights(report).map((line) => `  ${line}`));

	if (lifetime.modelCost.size > 0) {
		lines.push("", ...formatCostBars("Cost by model · lifetime spend share", lifetime.modelCost, lifetime.totalCost, { color }));
	}
	if (lifetime.cwdCost.size > 0) {
		lines.push("", ...formatCostBars("Cost by directory · lifetime spend share", lifetime.cwdCost, lifetime.totalCost, {
			color,
			transformKey: (key) => compactPathLabel(key, options.homeDir, 44),
		}));
	}

	if (lifetime.topCostSessions.length > 0) {
		lines.push("", ...formatSessionDrillDown(lifetime, color, "Session drill-down · lifetime · top 5 by cost"));
	}
	lines.push("", ...formatModelDrillDown(lifetime, color, "Model drill-down · lifetime · top 5 by cost"));
	lines.push("", ...formatDirectoryDrillDown(lifetime, { homeDir: options.homeDir, color, label: "Directory drill-down · lifetime · top 5 by cost" }));

	return lines.join("\n");
}
