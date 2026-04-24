import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type SkillIndexEntry = {
	name: string;
	skillFilePath: string;
	skillDir: string;
};

export type ContextSkillData = {
	name: string;
	loaded: boolean;
	tokens: number | null;
};

export type ContextUsageData = {
	messageTokens: number;
	contextWindow: number;
	effectiveTokens: number;
	percent: number;
	remainingTokens: number;
	systemPromptTokens: number;
	agentTokens: number;
	toolsTokens: number;
	activeTools: number;
};

export type ContextViewData = {
	usage: ContextUsageData | null;
	agentFiles: string[];
	extensions: string[];
	skills: ContextSkillData[];
	session: { totalTokens: number; totalCost: number };
};

const TOOL_FUDGE = 1.5;
export const SKILL_LOADED_ENTRY = "context:skill_loaded";

export type SkillLoadedEntryData = {
	name: string;
	path: string;
};

export function formatUsd(cost: number): string {
	if (!Number.isFinite(cost) || cost <= 0) return "$0.00";
	if (cost >= 1) return `$${cost.toFixed(2)}`;
	if (cost >= 0.1) return `$${cost.toFixed(3)}`;
	return `$${cost.toFixed(4)}`;
}

export function estimateTokens(text: string): number {
	return Math.max(0, Math.ceil(text.length / 4));
}

export function normalizeReadPath(inputPath: string, cwd: string): string {
	let p = inputPath;
	if (p.startsWith("@")) p = p.slice(1);
	if (p === "~") p = os.homedir();
	else if (p.startsWith("~/")) p = path.join(os.homedir(), p.slice(2));
	if (!path.isAbsolute(p)) p = path.resolve(cwd, p);
	return path.resolve(p);
}

export function getAgentDir(): string {
	const envCandidates = ["PI_CODING_AGENT_DIR", "TAU_CODING_AGENT_DIR"];
	let envDir: string | undefined;
	for (const key of envCandidates) {
		if (process.env[key]) {
			envDir = process.env[key];
			break;
		}
	}
	if (!envDir) {
		for (const [key, value] of Object.entries(process.env)) {
			if (key.endsWith("_CODING_AGENT_DIR") && value) {
				envDir = value;
				break;
			}
		}
	}

	if (envDir) {
		if (envDir === "~") return os.homedir();
		if (envDir.startsWith("~/")) return path.join(os.homedir(), envDir.slice(2));
		return envDir;
	}
	return path.join(os.homedir(), ".pi", "agent");
}

async function readFileIfExists(filePath: string): Promise<{ path: string; content: string; bytes: number } | null> {
	if (!existsSync(filePath)) return null;
	try {
		const content = await fs.readFile(filePath, "utf8");
		return { path: filePath, content, bytes: Buffer.byteLength(content) };
	} catch {
		return null;
	}
}

export async function loadProjectContextFiles(cwd: string): Promise<Array<{ path: string; tokens: number; bytes: number }>> {
	const files: Array<{ path: string; tokens: number; bytes: number }> = [];
	const seen = new Set<string>();

	const loadFromDir = async (dir: string) => {
		for (const name of ["AGENTS.md", "CLAUDE.md"]) {
			const filePath = path.join(dir, name);
			const file = await readFileIfExists(filePath);
			if (file && !seen.has(file.path)) {
				seen.add(file.path);
				files.push({ path: file.path, tokens: estimateTokens(file.content), bytes: file.bytes });
				return;
			}
		}
	};

	await loadFromDir(getAgentDir());

	const stack: string[] = [];
	let current = path.resolve(cwd);
	while (true) {
		stack.push(current);
		const parent = path.resolve(current, "..");
		if (parent === current) break;
		current = parent;
	}
	stack.reverse();
	for (const dir of stack) await loadFromDir(dir);

	return files;
}

export function normalizeSkillName(name: string): string {
	return name.startsWith("skill:") ? name.slice("skill:".length) : name;
}

export function buildSkillIndex(pi: ExtensionAPI, cwd: string): SkillIndexEntry[] {
	return pi
		.getCommands()
		.filter((command) => command.source === "skill")
		.map((command) => {
			const skillFilePath = command.sourceInfo?.path ? normalizeReadPath(command.sourceInfo.path, cwd) : "";
			return {
				name: normalizeSkillName(command.name),
				skillFilePath,
				skillDir: skillFilePath ? path.dirname(skillFilePath) : "",
			};
		})
		.filter((entry) => entry.name && entry.skillDir);
}

export function getLoadedSkillsFromSession(ctx: ExtensionContext): Set<string> {
	const loadedSkills = new Set<string>();
	for (const entry of ctx.sessionManager.getEntries()) {
		if ((entry as any)?.type !== "custom") continue;
		if ((entry as any)?.customType !== SKILL_LOADED_ENTRY) continue;
		const data = (entry as any)?.data as SkillLoadedEntryData | undefined;
		if (data?.name) loadedSkills.add(data.name);
	}
	return loadedSkills;
}

function extractCostTotal(usage: any): number {
	if (!usage) return 0;
	const cost = usage?.cost;
	if (typeof cost === "number") return Number.isFinite(cost) ? cost : 0;
	if (typeof cost === "string") {
		const value = Number(cost);
		return Number.isFinite(value) ? value : 0;
	}
	const total = cost?.total;
	if (typeof total === "number") return Number.isFinite(total) ? total : 0;
	if (typeof total === "string") {
		const value = Number(total);
		return Number.isFinite(value) ? value : 0;
	}
	return 0;
}

export function sumSessionUsage(ctx: ExtensionCommandContext): {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	totalCost: number;
} {
	let input = 0;
	let output = 0;
	let cacheRead = 0;
	let cacheWrite = 0;
	let totalCost = 0;

	for (const entry of ctx.sessionManager.getEntries()) {
		if ((entry as any)?.type !== "message") continue;
		const message = (entry as any)?.message;
		if (!message || message.role !== "assistant") continue;
		const usage = message.usage;
		if (!usage) continue;
		input += Number(usage.input ?? 0) || 0;
		output += Number(usage.output ?? 0) || 0;
		cacheRead += Number(usage.cacheRead ?? 0) || 0;
		cacheWrite += Number(usage.cacheWrite ?? 0) || 0;
		totalCost += extractCostTotal(usage);
	}

	return {
		input,
		output,
		cacheRead,
		cacheWrite,
		totalTokens: input + output + cacheRead + cacheWrite,
		totalCost,
	};
}

export function shortenPath(filePath: string, cwd: string): string {
	const resolvedPath = path.resolve(filePath);
	const resolvedCwd = path.resolve(cwd);
	if (resolvedPath === resolvedCwd) return ".";
	if (resolvedPath.startsWith(resolvedCwd + path.sep)) return `./${resolvedPath.slice(resolvedCwd.length + 1)}`;
	return resolvedPath;
}

export function formatExtensionName(sourcePath: string): string {
	if (sourcePath === "<unknown>") return sourcePath;
	const baseName = path.basename(sourcePath);
	if (baseName === "index.ts" || baseName === "index.js") {
		return path.basename(path.dirname(sourcePath));
	}
	return baseName;
}

async function estimateLoadedSkillTokens(skillIndex: SkillIndexEntry[], loadedSkills: Set<string>): Promise<Map<string, number>> {
	const skillIndexByName = new Map(skillIndex.map((entry) => [entry.name, entry] as const));
	const estimates = await Promise.all(
		Array.from(loadedSkills).map(async (name) => {
			const entry = skillIndexByName.get(name);
			if (!entry?.skillFilePath) return [name, 0] as const;
			try {
				const content = await fs.readFile(entry.skillFilePath, "utf8");
				return [name, estimateTokens(content)] as const;
			} catch {
				return [name, 0] as const;
			}
		}),
	);
	return new Map(estimates);
}

export async function buildContextViewData(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	skillIndex: SkillIndexEntry[],
	loadedSkills: Set<string>,
): Promise<ContextViewData> {
	const commands = pi.getCommands();
	const extensionFiles = Array.from(
		new Set(
			commands
				.filter((command) => command.source === "extension")
				.map((command) => formatExtensionName(command.sourceInfo?.path ?? "<unknown>")),
		),
	).sort((left, right) => left.localeCompare(right));

	const skillNames = commands
		.filter((command) => command.source === "skill")
		.map((command) => normalizeSkillName(command.name))
		.sort((left, right) => left.localeCompare(right));
	const loadedSkillTokens = await estimateLoadedSkillTokens(skillIndex, loadedSkills);
	const skills = skillNames.map((name) => ({
		name,
		loaded: loadedSkills.has(name),
		tokens: loadedSkillTokens.get(name) ?? null,
	}));

	const agentFiles = await loadProjectContextFiles(ctx.cwd);
	const agentFilePaths = agentFiles.map((file) => shortenPath(file.path, ctx.cwd));
	const agentTokens = agentFiles.reduce((total, file) => total + file.tokens, 0);

	const systemPrompt = ctx.getSystemPrompt();
	const systemPromptTokens = systemPrompt ? estimateTokens(systemPrompt) : 0;

	const usage = ctx.getContextUsage();
	const messageTokens = usage?.tokens ?? 0;
	const contextWindow = usage?.contextWindow ?? 0;

	const activeToolNames = pi.getActiveTools();
	const toolInfoByName = new Map(pi.getAllTools().map((tool) => [tool.name, tool] as const));
	let toolsTokens = 0;
	for (const name of activeToolNames) {
		const info = toolInfoByName.get(name);
		const blob = `${name}\n${info?.description ?? ""}`;
		toolsTokens += estimateTokens(blob);
	}
	toolsTokens = Math.round(toolsTokens * TOOL_FUDGE);

	const effectiveTokens = messageTokens + toolsTokens;
	const percent = contextWindow > 0 ? (effectiveTokens / contextWindow) * 100 : 0;
	const remainingTokens = contextWindow > 0 ? Math.max(0, contextWindow - effectiveTokens) : 0;

	const sessionUsage = sumSessionUsage(ctx);

	return {
		usage: usage
			? {
				messageTokens,
				contextWindow,
				effectiveTokens,
				percent,
				remainingTokens,
				systemPromptTokens,
				agentTokens,
				toolsTokens,
				activeTools: activeToolNames.length,
			}
			: null,
		agentFiles: agentFilePaths,
		extensions: extensionFiles,
		skills,
		session: { totalTokens: sessionUsage.totalTokens, totalCost: sessionUsage.totalCost },
	};
}
