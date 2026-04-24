import type { ExtensionAPI, ExtensionContext, ToolResultEvent } from "@mariozechner/pi-coding-agent";
import path from "node:path";
import {
	SKILL_LOADED_ENTRY,
	buildContextViewData,
	buildSkillIndex,
	getLoadedSkillsFromSession,
	normalizeReadPath,
	type SkillIndexEntry,
	type SkillLoadedEntryData,
} from "./data.ts";
import { buildPlainText } from "./render.ts";
import { ContextView } from "./view.ts";

export default function contextExtension(pi: ExtensionAPI) {
	let lastSessionId: string | null = null;
	let cachedLoadedSkills = new Set<string>();
	let cachedSkillIndex: SkillIndexEntry[] = [];
	let cachedEffectiveSystemPrompt: string | null = null;

	const ensureCaches = (ctx: ExtensionContext) => {
		const sessionId = ctx.sessionManager.getSessionId();
		if (sessionId !== lastSessionId) {
			lastSessionId = sessionId;
			cachedLoadedSkills = getLoadedSkillsFromSession(ctx);
			cachedSkillIndex = buildSkillIndex(pi, ctx.cwd);
			cachedEffectiveSystemPrompt = null;
		}
		if (cachedSkillIndex.length === 0) {
			cachedSkillIndex = buildSkillIndex(pi, ctx.cwd);
		}
	};

	const matchSkillForPath = (absolutePath: string): string | null => {
		let bestMatch: SkillIndexEntry | null = null;
		for (const skill of cachedSkillIndex) {
			if (!skill.skillDir) continue;
			if (absolutePath === skill.skillFilePath || absolutePath.startsWith(skill.skillDir + path.sep)) {
				if (!bestMatch || skill.skillDir.length > bestMatch.skillDir.length) bestMatch = skill;
			}
		}
		return bestMatch?.name ?? null;
	};

	pi.on("agent_start", (_event, ctx: ExtensionContext) => {
		ensureCaches(ctx);
		cachedEffectiveSystemPrompt = ctx.getSystemPrompt() || null;
	});

	pi.on("tool_result", (event: ToolResultEvent, ctx: ExtensionContext) => {
		if ((event as any).toolName !== "read") return;
		if ((event as any).isError) return;

		const input = (event as any).input as { path?: unknown } | undefined;
		const inputPath = typeof input?.path === "string" ? input.path : "";
		if (!inputPath) return;

		ensureCaches(ctx);
		const absolutePath = normalizeReadPath(inputPath, ctx.cwd);
		const skillName = matchSkillForPath(absolutePath);
		if (!skillName || cachedLoadedSkills.has(skillName)) return;

		cachedLoadedSkills.add(skillName);
		pi.appendEntry<SkillLoadedEntryData>(SKILL_LOADED_ENTRY, { name: skillName, path: absolutePath });
	});

	pi.registerCommand("context", {
		description: "Show loaded context overview",
		handler: async (_args, ctx) => {
			ensureCaches(ctx);
			const data = await buildContextViewData(pi, ctx, cachedSkillIndex, cachedLoadedSkills, cachedEffectiveSystemPrompt);

			if (!ctx.hasUI) {
				pi.sendMessage({ customType: "context", content: buildPlainText(data), display: true }, { triggerTurn: false });
				return;
			}

			await ctx.ui.custom<void>((tui, theme, _kb, done) => new ContextView(tui, theme as any, data, done));
		},
	});
}
