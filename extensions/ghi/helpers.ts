import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildWorkflowSessionName } from "../session-names/helpers.ts";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const ISSUE_CREATE_SKILL_PATH = path.resolve(
	currentDir,
	"..",
	"..",
	"skills",
	"pac-github-issue-create",
	"SKILL.md",
);

export async function loadIssueCreateSkill(skillPath: string = ISSUE_CREATE_SKILL_PATH): Promise<string | null> {
	try {
		const content = await fs.readFile(skillPath, "utf8");
		const trimmed = content.trim();
		return trimmed || null;
	} catch {
		return null;
	}
}

export function normalizeIssueNote(input: string): string {
	return input.trim();
}

export function buildIssueSessionName(note: string): string | undefined {
	return buildWorkflowSessionName("ghi", note);
}

export function buildIssueCreatePrompt(skillContent: string, note: string): string {
	return [
		skillContent.trim(),
		"",
		"---",
		"",
		"Create a GitHub issue for the current repository based on the note below.",
		"Stay within this create-only /ghi workflow.",
		"If the note is too ambiguous to create a useful issue, ask at most one brief follow-up question before creating it.",
		"",
		"Issue note:",
		normalizeIssueNote(note),
	].join("\n");
}
