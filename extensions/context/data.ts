import {
	formatSkillsForPrompt,
	estimateTokens as estimateMessageTokens,
	type ExtensionAPI,
	type ExtensionCommandContext,
	type ExtensionContext,
	type Skill,
} from "@mariozechner/pi-coding-agent";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { formatSharedAgentsSystemPrompt, loadSharedAgents, sharedAgentsPath } from "../shared-agents/prompt.ts";

export type SkillIndexEntry = {
	name: string;
	description: string;
	skillFilePath: string;
	skillDir: string;
	sourceInfo: Skill["sourceInfo"];
};

export type ContextPathTokens = {
	path: string;
	tokens: number;
};

export type ContextSkillData = {
	name: string;
	loaded: boolean;
	tokens: number | null;
};

export type ContextUsageData = {
	windowTokens: number;
	contextWindow: number;
	windowEffectiveTokens: number;
	percent: number;
	remainingTokens: number;
	usedTokens: number;
	estimatedMessageTokens: number;
	systemPromptTokens: number;
	toolsTokens: number;
	activeTools: number;
};

export type ContextSystemBreakdownData = {
	totalTokens: number;
	piInstructionsTokens: number;
	sharedInstructions: ContextPathTokens | null;
	packageSkillsIndexTokens: number;
	globalSkillsIndexTokens: number;
	projectSkillsIndexTokens: number;
};

export type ContextViewData = {
	usage: ContextUsageData | null;
	systemBreakdown: ContextSystemBreakdownData | null;
	agentFiles: ContextPathTokens[];
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

function estimateBranchMessageTokens(ctx: ExtensionCommandContext): number {
	let total = 0;
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type !== "message") continue;
		total += estimateMessageTokens(entry.message);
	}
	return total;
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

export async function loadProjectContextFiles(cwd: string): Promise<Array<{ path: string; content: string; tokens: number; bytes: number }>> {
	const files: Array<{ path: string; content: string; tokens: number; bytes: number }> = [];
	const seen = new Set<string>();

	const loadFromDir = async (dir: string) => {
		for (const name of ["AGENTS.md", "CLAUDE.md"]) {
			const filePath = path.join(dir, name);
			const file = await readFileIfExists(filePath);
			if (file && !seen.has(file.path)) {
				seen.add(file.path);
				files.push({ ...file, tokens: estimateTokens(file.content) });
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
				description: command.description ?? "",
				skillFilePath,
				skillDir: skillFilePath ? path.dirname(skillFilePath) : "",
				sourceInfo: command.sourceInfo,
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

function escapeXml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

function formatSkillIndexEntry(skill: SkillIndexEntry): string {
	return [
		"  <skill>",
		`    <name>${escapeXml(skill.name)}</name>`,
		`    <description>${escapeXml(skill.description)}</description>`,
		`    <location>${escapeXml(skill.skillFilePath)}</location>`,
		"  </skill>",
	].join("\n");
}

function estimateSkillIndexTokensByGroup(skillIndex: SkillIndexEntry[]): {
	packageTokens: number;
	globalTokens: number;
	projectTokens: number;
} {
	let packageTokens = 0;
	let globalTokens = 0;
	let projectTokens = 0;

	for (const skill of skillIndex) {
		const entryTokens = estimateTokens(formatSkillIndexEntry(skill));
		if (skill.sourceInfo.origin === "package") {
			packageTokens += entryTokens;
			continue;
		}
		if (skill.sourceInfo.scope === "user") {
			globalTokens += entryTokens;
			continue;
		}
		projectTokens += entryTokens;
	}

	return { packageTokens, globalTokens, projectTokens };
}

function ensureSharedInstructionsInPrompt(systemPrompt: string, sharedInstructionsPrompt: string): string {
	if (!sharedInstructionsPrompt) return systemPrompt;
	if (systemPrompt.includes(sharedInstructionsPrompt)) return systemPrompt;
	return `${systemPrompt}\n\n${sharedInstructionsPrompt}`;
}

async function buildSystemBreakdown(
	cwd: string,
	systemPrompt: string,
	agentFiles: Array<{ path: string; content: string; tokens: number }>,
	skillIndex: SkillIndexEntry[],
	hasReadTool: boolean,
): Promise<{ breakdown: ContextSystemBreakdownData; agentFiles: ContextPathTokens[] }> {
	const sharedAgentsContent = await loadSharedAgents();
	const sharedInstructionsPrompt = sharedAgentsContent ? formatSharedAgentsSystemPrompt(sharedAgentsContent) : "";
	const effectiveSystemPrompt = ensureSharedInstructionsInPrompt(systemPrompt, sharedInstructionsPrompt);
	const totalTokens = estimateTokens(effectiveSystemPrompt);
	const agentFileEntries = agentFiles
		.map((file) => {
			const promptBlock = `## ${file.path}\n\n${file.content}\n\n`;
			if (!effectiveSystemPrompt.includes(promptBlock)) return null;
			return {
				path: shortenPath(file.path, cwd),
				tokens: estimateTokens(promptBlock),
			};
		})
		.filter((entry): entry is ContextPathTokens => entry !== null);
	const sharedInstructions =
		sharedInstructionsPrompt && effectiveSystemPrompt.includes(sharedInstructionsPrompt)
			? {
					path: shortenPath(sharedAgentsPath, cwd),
					tokens: estimateTokens(sharedInstructionsPrompt),
				}
			: null;

	const skillsCatalogPrompt = hasReadTool
		? formatSkillsForPrompt(
				skillIndex.map((skill) => ({
					name: skill.name,
					description: skill.description,
					filePath: skill.skillFilePath,
					baseDir: skill.skillDir,
					sourceInfo: skill.sourceInfo,
					disableModelInvocation: false,
				})),
			)
		: "";
	const skillsCatalogTokens = skillsCatalogPrompt ? estimateTokens(skillsCatalogPrompt) : 0;
	const skillIndexGroupTokens = estimateSkillIndexTokensByGroup(skillIndex);

	const knownTokens =
		agentFileEntries.reduce((total, file) => total + file.tokens, 0) +
		(sharedInstructions?.tokens ?? 0) +
		skillsCatalogTokens;

	return {
		agentFiles: agentFileEntries,
		breakdown: {
			totalTokens,
			piInstructionsTokens: Math.max(0, totalTokens - ((sharedInstructions?.tokens ?? 0) + agentFileEntries.reduce((total, file) => total + file.tokens, 0) + skillIndexGroupTokens.packageTokens + skillIndexGroupTokens.globalTokens + skillIndexGroupTokens.projectTokens)),
			sharedInstructions,
			packageSkillsIndexTokens: skillIndexGroupTokens.packageTokens,
			globalSkillsIndexTokens: skillIndexGroupTokens.globalTokens,
			projectSkillsIndexTokens: skillIndexGroupTokens.projectTokens,
		},
	};
}

export async function buildContextViewData(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	skillIndex: SkillIndexEntry[],
	loadedSkills: Set<string>,
	effectiveSystemPrompt?: string | null,
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

	const projectContextFiles = await loadProjectContextFiles(ctx.cwd);

	const activeToolNames = pi.getActiveTools();
	const baseSystemPrompt = effectiveSystemPrompt ?? ctx.getSystemPrompt();
	const sharedAgentsContent = await loadSharedAgents();
	const sharedInstructionsPrompt = sharedAgentsContent ? formatSharedAgentsSystemPrompt(sharedAgentsContent) : "";
	const systemPrompt = baseSystemPrompt ? ensureSharedInstructionsInPrompt(baseSystemPrompt, sharedInstructionsPrompt) : baseSystemPrompt;
	const systemPromptTokens = systemPrompt ? estimateTokens(systemPrompt) : 0;
	const systemBreakdownResult = systemPrompt
		? await buildSystemBreakdown(ctx.cwd, systemPrompt, projectContextFiles, skillIndex, activeToolNames.includes("read"))
		: null;
	const systemBreakdown = systemBreakdownResult?.breakdown ?? null;
	const agentFiles = systemBreakdownResult?.agentFiles ?? [];

	const usage = ctx.getContextUsage();
	const windowTokens = usage?.tokens ?? 0;
	const contextWindow = usage?.contextWindow ?? 0;

	const toolInfoByName = new Map(pi.getAllTools().map((tool) => [tool.name, tool] as const));
	let toolsTokens = 0;
	for (const name of activeToolNames) {
		const info = toolInfoByName.get(name);
		const blob = `${name}\n${info?.description ?? ""}`;
		toolsTokens += estimateTokens(blob);
	}
	toolsTokens = Math.round(toolsTokens * TOOL_FUDGE);

	const estimatedMessageTokens = estimateBranchMessageTokens(ctx);
	const usedTokens = systemPromptTokens + toolsTokens + estimatedMessageTokens;
	const windowEffectiveTokens = windowTokens + toolsTokens;
	const percent = contextWindow > 0 ? (windowEffectiveTokens / contextWindow) * 100 : 0;
	const remainingTokens = contextWindow > 0 ? Math.max(0, contextWindow - windowEffectiveTokens) : 0;

	const sessionUsage = sumSessionUsage(ctx);

	return {
		usage: usage
			? {
				windowTokens,
				contextWindow,
				windowEffectiveTokens,
				percent,
				remainingTokens,
				usedTokens,
				estimatedMessageTokens,
				systemPromptTokens,
				toolsTokens,
				activeTools: activeToolNames.length,
			}
			: null,
		systemBreakdown,
		agentFiles,
		extensions: extensionFiles,
		skills,
		session: { totalTokens: sessionUsage.totalTokens, totalCost: sessionUsage.totalCost },
	};
}
