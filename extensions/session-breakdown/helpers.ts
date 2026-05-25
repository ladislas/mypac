import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import { getSessionRoot } from "../../lib/agent-dir.ts";

export const SESSION_BREAKDOWN_RANGES = [7, 30, 90] as const;
export const DEFAULT_SESSION_ROOT = getSessionRoot();

type ModelKey = string;
type CwdKey = string;

export interface ParsedSession {
	filePath: string;
	startedAt: Date;
	dayKey: string;
	cwd: CwdKey | null;
	modelsUsed: Set<ModelKey>;
	messages: number;
	tokens: number;
	totalCost: number;
	messagesByModel: Map<ModelKey, number>;
	tokensByModel: Map<ModelKey, number>;
	costByModel: Map<ModelKey, number>;
}

export interface DayAggregate {
	date: Date;
	dayKey: string;
	sessions: number;
	messages: number;
	tokens: number;
	totalCost: number;
}

export interface RangeAggregate {
	days: DayAggregate[];
	dayByKey: Map<string, DayAggregate>;
	sessions: number;
	totalMessages: number;
	totalTokens: number;
	totalCost: number;
	modelSessions: Map<ModelKey, number>;
	modelMessages: Map<ModelKey, number>;
	modelTokens: Map<ModelKey, number>;
	modelCost: Map<ModelKey, number>;
	cwdSessions: Map<CwdKey, number>;
	cwdMessages: Map<CwdKey, number>;
	cwdTokens: Map<CwdKey, number>;
	cwdCost: Map<CwdKey, number>;
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
	startedAt: Date | null;
	cwd: string | null;
	currentModel: string | null;
	messages: number;
	tokens: number;
	totalCost: number;
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
	const cache = readNumber(usage.cacheRead) + readNumber(usage.cache_read) + readNumber(usage.cacheWrite) + readNumber(usage.cache_write);
	return input + output + cache;
}

function extractCost(usage: any): number {
	if (!usage) return 0;
	const direct = readNumber(usage.cost);
	if (direct > 0) return direct;
	return readNumber(usage.cost?.total);
}

export function parseSessionStartFromFilename(name: string): Date | null {
	const match = name.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z_/);
	if (!match) return null;
	const date = new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`);
	return Number.isFinite(date.getTime()) ? date : null;
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
		startedAt: parseSessionStartFromFilename(basename(filePath)),
		cwd: null,
		currentModel: null,
		messages: 0,
		tokens: 0,
		totalCost: 0,
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
		if (!state.startedAt && typeof entry.timestamp === "string") {
			const date = new Date(entry.timestamp);
			if (Number.isFinite(date.getTime())) state.startedAt = date;
		}
		if (typeof entry.cwd === "string" && entry.cwd.trim()) state.cwd = entry.cwd.trim();
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
	const key = modelKeyFromFields(fields.provider, fields.model, fields.modelId) ?? state.currentModel ?? "unknown";
	const entryTokens = extractTokens(fields.usage);
	const entryCost = extractCost(fields.usage);

	state.messages += 1;
	state.tokens += entryTokens;
	state.totalCost += entryCost;
	state.modelsUsed.add(key);
	addToMap(state.messagesByModel, key, 1);
	addToMap(state.tokensByModel, key, entryTokens);
	addToMap(state.costByModel, key, entryCost);
}

function finalizeSessionParseState(state: SessionParseState): ParsedSession | null {
	if (!state.startedAt) return null;
	return {
		filePath: state.filePath,
		startedAt: state.startedAt,
		dayKey: toDayKey(state.startedAt),
		cwd: state.cwd,
		modelsUsed: state.modelsUsed,
		messages: state.messages,
		tokens: state.tokens,
		totalCost: state.totalCost,
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
		return { session: finalizeSessionParseState(state), skippedLines: state.skippedLines };
	} catch {
		return { session: null, skippedLines: state.skippedLines, error: `Could not read ${basename(filePath)}` };
	} finally {
		reader.close();
		stream.destroy();
	}
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
		const aggregate = { date, dayKey, sessions: 0, messages: 0, tokens: 0, totalCost: 0 };
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
		modelSessions: new Map(),
		modelMessages: new Map(),
		modelTokens: new Map(),
		modelCost: new Map(),
		cwdSessions: new Map(),
		cwdMessages: new Map(),
		cwdTokens: new Map(),
		cwdCost: new Map(),
	};
}

function addSession(range: RangeAggregate, session: ParsedSession): void {
	const day = range.dayByKey.get(session.dayKey);
	if (!day) return;

	range.sessions += 1;
	range.totalMessages += session.messages;
	range.totalTokens += session.tokens;
	range.totalCost += session.totalCost;
	day.sessions += 1;
	day.messages += session.messages;
	day.tokens += session.tokens;
	day.totalCost += session.totalCost;

	for (const model of session.modelsUsed) addToMap(range.modelSessions, model, 1);
	for (const [model, count] of session.messagesByModel) addToMap(range.modelMessages, model, count);
	for (const [model, count] of session.tokensByModel) addToMap(range.modelTokens, model, count);
	for (const [model, count] of session.costByModel) addToMap(range.modelCost, model, count);

	if (session.cwd) {
		addToMap(range.cwdSessions, session.cwd, 1);
		addToMap(range.cwdMessages, session.cwd, session.messages);
		addToMap(range.cwdTokens, session.cwd, session.tokens);
		addToMap(range.cwdCost, session.cwd, session.totalCost);
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
	for (const file of scanned.files) {
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

function sortMap(map: Map<string, number>): Array<[string, number]> {
	return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
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

	for (const days of SESSION_BREAKDOWN_RANGES) {
		const range = report.ranges.get(days);
		if (!range) continue;
		lines.push("", `Last ${days} days`);
		lines.push(
			`  sessions: ${formatNumber(range.sessions)} · messages: ${formatNumber(range.totalMessages)} · tokens: ${formatNumber(range.totalTokens)} · cost: ${formatCost(range.totalCost)}`,
		);
		lines.push(...formatTopMap("sessions by model", range.modelSessions, formatNumber));
		lines.push(...formatTopMap("messages by model", range.modelMessages, formatNumber));
		lines.push(...formatOptionalTopMap("tokens by model", range.modelTokens, formatNumber));
		lines.push(...formatOptionalTopMap("cost by model", range.modelCost, formatCost));
		lines.push(...formatTopMap("sessions by directory", range.cwdSessions, formatNumber, (key) => abbreviatePath(key, options.homeDir)));
		lines.push(...formatTopMap("messages by directory", range.cwdMessages, formatNumber, (key) => abbreviatePath(key, options.homeDir)));
		lines.push(...formatOptionalTopMap("tokens by directory", range.cwdTokens, formatNumber, (key) => abbreviatePath(key, options.homeDir)));
		lines.push(...formatOptionalTopMap("cost by directory", range.cwdCost, formatCost, (key) => abbreviatePath(key, options.homeDir)));
	}

	return lines.join("\n");
}
