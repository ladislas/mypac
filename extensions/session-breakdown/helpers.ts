import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { getSessionRoot } from "../../lib/agent-dir.ts";

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
}

export interface AnalyzeSessionDirectoryOptions {
	root?: string;
	now?: Date;
	signal?: AbortSignal;
}

export function getDefaultSessionRoot(env: NodeJS.ProcessEnv = process.env, homeDir: string = homedir()): string {
	return getSessionRoot(env, homeDir);
}

interface SessionParseState {
	filePath: string;
	sessionId: string | null;
	title: string | null;
	repo: string | null;
	firstUserText: string | null;
	startedAt: Date | null;
	cwd: string | null;
	currentModel: string | null;
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
	skippedLines: number;
	modelsUsed: Set<string>;
	messagesByModel: Map<string, number>;
	tokensByModel: Map<string, number>;
	costByModel: Map<string, number>;
}

function readNumber(value: unknown): number {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
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

function getErrorCode(error: unknown): string | undefined {
	return typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
}

function modelKey(provider: unknown, model: unknown): string | null {
	const providerText = typeof provider === "string" ? provider.trim() : "";
	const modelText = typeof model === "string" ? model.trim() : "";
	if (!providerText && !modelText) return null;
	if (!providerText) return modelText;
	if (!modelText) return providerText;
	return `${providerText}/${modelText}`;
}

function modelKeyFromFields(provider: unknown, model: unknown, modelId: unknown): string | null {
	const modelText = typeof model === "string" && model.trim() ? model : undefined;
	const modelIdText = typeof modelId === "string" && modelId.trim() ? modelId : undefined;
	if (!modelText && !modelIdText) return null;
	return modelKey(provider, modelText ?? modelIdText);
}

function extractMessageFields(entry: any): { provider?: unknown; model?: unknown; modelId?: unknown; usage?: unknown } {
	const message = entry?.message;
	return {
		provider: entry?.provider ?? message?.provider,
		model: entry?.model ?? message?.model,
		modelId: entry?.modelId ?? message?.modelId,
		usage: entry?.usage ?? message?.usage,
	};
}

function extractTokens(usage: any): number {
	if (!usage) return 0;
	const direct =
		readNumber(usage.totalTokens) ||
		readNumber(usage.total_tokens) ||
		readNumber(usage.tokens) ||
		readNumber(usage.tokenCount) ||
		readNumber(usage.token_count);
	if (direct > 0) return direct;

	const nested = readNumber(usage.tokens?.total) || readNumber(usage.tokens?.totalTokens) || readNumber(usage.tokens?.total_tokens);
	if (nested > 0) return nested;

	const input =
		readNumber(usage.promptTokens) ||
		readNumber(usage.prompt_tokens) ||
		readNumber(usage.inputTokens) ||
		readNumber(usage.input_tokens) ||
		readNumber(usage.input);
	const output =
		readNumber(usage.completionTokens) ||
		readNumber(usage.completion_tokens) ||
		readNumber(usage.outputTokens) ||
		readNumber(usage.output_tokens) ||
		readNumber(usage.output);
	const cache = extractCacheReadTokens(usage) + extractCacheWriteTokens(usage);
	return input + output + cache;
}

function extractCacheReadTokens(usage: any): number {
	if (!usage) return 0;
	return readNumber(usage.cacheRead) + readNumber(usage.cache_read) + readNumber(usage.cacheReadTokens) + readNumber(usage.cache_read_tokens);
}

function extractCacheWriteTokens(usage: any): number {
	if (!usage) return 0;
	return readNumber(usage.cacheWrite) + readNumber(usage.cache_write) + readNumber(usage.cacheWriteTokens) + readNumber(usage.cache_write_tokens);
}

function extractInputTokens(usage: any): number {
	if (!usage) return 0;
	return readNumber(usage.promptTokens) || readNumber(usage.prompt_tokens) || readNumber(usage.inputTokens) || readNumber(usage.input_tokens) || readNumber(usage.input);
}

function extractOutputTokens(usage: any): number {
	if (!usage) return 0;
	return readNumber(usage.completionTokens) || readNumber(usage.completion_tokens) || readNumber(usage.outputTokens) || readNumber(usage.output_tokens) || readNumber(usage.output);
}

function extractContextTokens(usage: any): number {
	if (!usage) return 0;
	return readNumber(usage.contextTokens) || readNumber(usage.context_tokens) || readNumber(usage.context);
}

function extractMaxContextTokens(usage: any): number {
	if (!usage) return 0;
	return readNumber(usage.maxContextTokens) || readNumber(usage.max_context_tokens) || readNumber(usage.contextWindow) || readNumber(usage.context_window);
}

function extractCost(usage: any): number {
	if (!usage) return 0;
	const direct = readNumber(usage.cost);
	if (direct > 0) return direct;
	return readNumber(usage.cost?.total);
}

interface ModelPricing {
	input: number;
	output: number;
	cacheRead?: number;
	cacheWrite?: number;
}

// USD per 1M tokens, sourced from models.dev upstream provider catalog.
const COPILOT_MARKET_PRICING: Array<{ pattern: RegExp; pricing: ModelPricing }> = [
	{ pattern: /(?:^|\/)claude-sonnet(?:$|[-_.])/, pricing: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 } },
];

function estimateMarketCost(model: string, usage: any): number {
	if (!usage || !/(^|\/)github-copilot\//.test(model) && !/(^|\/)copilot\//.test(model)) return 0;
	const match = COPILOT_MARKET_PRICING.find((entry) => entry.pattern.test(model));
	if (!match) return 0;

	const input = extractInputTokens(usage);
	const output = extractOutputTokens(usage);
	const cacheRead = extractCacheReadTokens(usage);
	const cacheWrite = extractCacheWriteTokens(usage);
	if (input + output + cacheRead + cacheWrite <= 0) return 0;

	const pricing = match.pricing;
	return (input * pricing.input + output * pricing.output + cacheRead * (pricing.cacheRead ?? pricing.input) + cacheWrite * (pricing.cacheWrite ?? pricing.input)) / 1_000_000;
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

function deriveFallbackTitle(state: SessionParseState): string | null {
	if (state.firstUserText) return summarizeUserText(state.firstUserText, inferGitHubRepoFromPath(state.cwd));
	if (state.cwd) return humanizeSlug(basename(state.cwd));
	const title = humanizeSlug(basename(state.filePath));
	return title || null;
}

function inferWorkflowType(session: ParsedSession): string {
	const text = basename(session.filePath).toLowerCase();
	if (/(^|[-_])(?:pac-)?lwot([-_.]|$)/.test(text)) return "lwot";
	if (/(^|[-_])grill([-_.]|$)/.test(text)) return "grill";
	if (/(^|[-_])review([-_.]|$)/.test(text)) return "review";
	if (/(^|[-_])triage([-_.]|$)/.test(text)) return "triage";
	if (/\b(implement|implementation|feature|bugfix|fix|commit)\b|feature[-_]|bugfix[-_]/.test(text)) return "implementation";
	return "other";
}

export function parseSessionStartFromFilename(name: string): Date | null {
	const match = name.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z_/);
	if (!match) return null;
	const date = new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`);
	return Number.isFinite(date.getTime()) ? date : null;
}

function parseSessionIdFromFilename(name: string): string | null {
	const match = name.match(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_(.+)\.jsonl$/);
	return match?.[1] ?? null;
}

export function parseSessionLines(content: string, filePath = "session.jsonl"): ParsedSession | null {
	const state = createSessionParseState(filePath);
	for (const line of content.split(/\r?\n/)) {
		parseSessionLine(state, line);
	}
	return finalizeSessionParseState(state);
}

function createSessionParseState(filePath: string): SessionParseState {
	return {
		filePath,
		sessionId: parseSessionIdFromFilename(basename(filePath)),
		title: null,
		repo: null,
		firstUserText: null,
		startedAt: parseSessionStartFromFilename(basename(filePath)),
		cwd: null,
		currentModel: null,
		messages: 0,
		tokens: 0,
		totalCost: 0,
		estimatedCost: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		inputTokens: 0,
		outputTokens: 0,
		contextTokensTotal: 0,
		contextSamples: 0,
		maxContextTokens: 0,
		skippedLines: 0,
		modelsUsed: new Set(),
		messagesByModel: new Map(),
		tokensByModel: new Map(),
		costByModel: new Map(),
	};
}

function parseSessionLine(state: SessionParseState, line: string): void {
	if (!line.trim()) return;
	let entry: any;
	try {
		entry = JSON.parse(line);
	} catch {
		state.skippedLines += 1;
		return;
	}

	if (entry?.type === "session") {
		if (typeof entry.id === "string" && entry.id.trim()) state.sessionId = entry.id.trim();
		if (!state.startedAt && typeof entry.timestamp === "string") {
			const date = new Date(entry.timestamp);
			if (Number.isFinite(date.getTime())) state.startedAt = date;
		}
		if (typeof entry.cwd === "string" && entry.cwd.trim()) {
			state.cwd = entry.cwd.trim();
			state.repo = inferGitHubRepoFromPath(state.cwd);
		}
		return;
	}

	if (entry?.type === "session_info") {
		if (typeof entry.name === "string" && entry.name.trim()) state.title = summarizeUserText(entry.name, inferGitHubRepoFromPath(state.cwd));
		return;
	}

	if (entry?.type === "model_change") {
		const key = modelKey(entry.provider, entry.modelId ?? entry.model);
		if (key) {
			state.currentModel = key;
			state.modelsUsed.add(key);
		}
		return;
	}

	if (entry?.type !== "message") return;
	const fields = extractMessageFields(entry);
	if (!state.firstUserText && entry?.message?.role === "user") state.firstUserText = extractTextContent(entry.message.content);
	const key = modelKeyFromFields(fields.provider, fields.model, fields.modelId) ?? state.currentModel ?? "unknown";
	const entryTokens = extractTokens(fields.usage);
	const reportedCost = extractCost(fields.usage);
	const estimatedCost = reportedCost > 0 ? 0 : estimateMarketCost(key, fields.usage);
	const entryCost = reportedCost || estimatedCost;
	const cacheReadTokens = extractCacheReadTokens(fields.usage);
	const cacheWriteTokens = extractCacheWriteTokens(fields.usage);
	const inputTokens = extractInputTokens(fields.usage);
	const outputTokens = extractOutputTokens(fields.usage);
	const contextTokens = extractContextTokens(fields.usage);
	const maxContextTokens = extractMaxContextTokens(fields.usage);

	state.messages += 1;
	state.tokens += entryTokens;
	state.totalCost += entryCost;
	state.estimatedCost += estimatedCost;
	state.cacheReadTokens += cacheReadTokens;
	state.cacheWriteTokens += cacheWriteTokens;
	state.inputTokens += inputTokens;
	state.outputTokens += outputTokens;
	if (contextTokens > 0) {
		state.contextTokensTotal += contextTokens;
		state.contextSamples += 1;
	}
	state.maxContextTokens = Math.max(state.maxContextTokens, contextTokens, maxContextTokens);
	state.modelsUsed.add(key);
	addToMap(state.messagesByModel, key, 1);
	addToMap(state.tokensByModel, key, entryTokens);
	addToMap(state.costByModel, key, entryCost);
}

function finalizeSessionParseState(state: SessionParseState): ParsedSession | null {
	if (!state.startedAt) return null;
	return {
		filePath: state.filePath,
		sessionId: state.sessionId,
		title: state.title ?? deriveFallbackTitle(state),
		repo: state.repo,
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

async function parseSessionFile(filePath: string, signal?: AbortSignal): Promise<{ session: ParsedSession | null; skippedLines: number; error?: string }> {
	const state = createSessionParseState(filePath);
	const stream = createReadStream(filePath, { encoding: "utf8" });
	const reader = createInterface({ input: stream, crlfDelay: Infinity });
	try {
		for await (const line of reader) {
			if (signal?.aborted) return { session: null, skippedLines: state.skippedLines };
			parseSessionLine(state, line);
		}
		const session = finalizeSessionParseState(state);
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

const canonicalDirectoryGroupCache = new Map<string, Promise<string>>();

async function resolveCanonicalDirectoryGroup(cwd: string): Promise<string> {
	let cached = canonicalDirectoryGroupCache.get(cwd);
	if (!cached) {
		cached = resolveCanonicalDirectoryGroupUncached(cwd).catch((error) => {
			canonicalDirectoryGroupCache.delete(cwd);
			throw error;
		});
		canonicalDirectoryGroupCache.set(cwd, cached);
	}
	return cached;
}

async function resolveCanonicalDirectoryGroupUncached(cwd: string): Promise<string> {
	const worktreeFallback = inferCanonicalRepoPathFromWorktreePath(cwd);
	let current = cwd;
	while (true) {
		const dotGit = join(current, ".git");
		try {
			const metadata = await stat(dotGit);
			if (metadata.isDirectory()) return current;
			if (metadata.isFile()) {
				const text = await readFile(dotGit, "utf8");
				const match = text.match(/^gitdir:\s*(.+)\s*$/m);
				if (!match) return current;
				const gitDir = resolve(current, match[1]);
				const commonDirText = await readFile(join(gitDir, "commondir"), "utf8").catch(() => "");
				const commonGitDir = commonDirText.trim() ? resolve(gitDir, commonDirText.trim()) : gitDir;
				return basename(commonGitDir) === ".git" ? dirname(commonGitDir) : current;
			}
		} catch {
			// Keep walking toward the filesystem root.
		}

		const parent = dirname(current);
		if (parent === current) return worktreeFallback ?? cwd;
		current = parent;
	}
}

function inferCanonicalRepoPathFromWorktreePath(path: string): string | null {
	const normalized = path.replace(/\\/g, "/");
	const match = normalized.match(/^(.*\/dev)\/worktrees\/([^/]+)\/([^/]+)(?:\/.*)?$/);
	if (!match) return null;
	return `${match[1]}/${match[2]}/${match[3]}`;
}

async function walkSessionFiles(root: string, cutoff: Date, signal?: AbortSignal): Promise<{ files: string[]; unreadableFiles: number; lastError?: string }> {
	const files: string[] = [];
	let unreadableFiles = 0;
	let lastError: string | undefined;
	const stack = [root];
	while (stack.length > 0) {
		if (signal?.aborted) break;
		const dir = stack.pop();
		if (!dir) continue;
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch (error) {
			if (getErrorCode(error) !== "ENOENT") {
				unreadableFiles += 1;
				lastError = `Could not read ${basename(dir)}`;
			}
			continue;
		}

		for (const entry of entries) {
			const filePath = join(dir, entry.name);
			if (entry.isDirectory()) {
				stack.push(filePath);
				continue;
			}
			if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;

			const filenameDate = parseSessionStartFromFilename(entry.name);
			if (filenameDate) {
				if (localMidnight(filenameDate) >= cutoff) files.push(filePath);
				continue;
			}

			try {
				const stats = await stat(filePath);
				if (localMidnight(new Date(stats.mtimeMs)) >= cutoff) files.push(filePath);
			} catch {
				unreadableFiles += 1;
				lastError = `Could not stat ${entry.name}`;
			}
		}
	}
	return { files, unreadableFiles, lastError };
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

function addSession(range: RangeAggregate, session: ParsedSession): void {
	const day = range.dayByKey.get(session.dayKey);
	if (!day) return;

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
	day.sessions += 1;
	day.messages += session.messages;
	day.tokens += session.tokens;
	day.totalCost += session.totalCost;
	day.estimatedCost += session.estimatedCost;

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

export async function analyzeSessionDirectory(options: AnalyzeSessionDirectoryOptions = {}): Promise<SessionBreakdownReport> {
	const root = options.root ?? DEFAULT_SESSION_ROOT;
	const now = options.now ?? new Date();
	const maxRangeDays = Math.max(...SESSION_BREAKDOWN_RANGES);
	const cutoff = addDays(localMidnight(now), -(maxRangeDays - 1));
	const scanned = await walkSessionFiles(root, cutoff, options.signal);
	const ranges = new Map<number, RangeAggregate>();
	for (const days of SESSION_BREAKDOWN_RANGES) ranges.set(days, createRangeAggregate(days, now));

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
	return [...report.ranges.values()].some((range) => range.estimatedCost > 0);
}

function formatEstimatedCostNote(report: SessionBreakdownReport): string | null {
	return hasEstimatedCosts(report) ? "Cost note: includes estimated market cost for subscription-included usage; actual billed cost may be lower." : null;
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

function formatSessionDrillDown(range: RangeAggregate, color: boolean): string[] {
	const lines = [colorize("Session drill-down · 7d · top 5 by cost", "bold", color)];
	if (range.topCostSessions.length === 0) return [...lines, "  none"];
	lines.push(`${padCell("Cost", 7)} ${padCell("Date", 10)} ${padCell("ID", 16)} ${padCell("Msgs", 5)} ${padCell("Tokens", 7)} ${padCell("Main model", 24)} Title`);
	for (const session of range.topCostSessions.slice(0, 5)) {
		lines.push(
			`${padCell(formatCost(session.totalCost), 7)} ${formatDate(session.startedAt)} ${padCell(formatShortSessionId(session.sessionId), 16)} ${padCell(formatNumber(session.messages), 5)} ${padCell(formatNumber(session.tokens), 7)} ${compactCell(formatCompactModelName(session.mainModel), 24)} ${compactSessionTitle(session, 36)}`,
		);
	}
	return lines;
}

function formatModelDrillDown(range: RangeAggregate, color: boolean): string[] {
	const rows = sortMap(range.modelCost).slice(0, 5);
	const modelWidth = 32;
	const lines = [colorize("Model drill-down · 30d · top 5 by cost", "bold", color)];
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

function formatDirectoryDrillDown(range: RangeAggregate, options: { homeDir?: string; color: boolean }): string[] {
	const rows = sortMap(range.cwdCost).slice(0, 5);
	const lines = [colorize("Directory drill-down · 30d · top 5 by cost", "bold", options.color)];
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
