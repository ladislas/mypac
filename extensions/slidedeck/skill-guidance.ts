import { readFileSync } from "node:fs";
import { buildSlidedeckPrompt } from "./helpers.ts";

const PORTABLE_SKILL_URL = new URL("../../skills/pac-slidedeck/SKILL.md", import.meta.url);

export function getPortableSlidedeckGuidance(): string {
	const source = readFileSync(PORTABLE_SKILL_URL, "utf8");
	const match = source.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)([\s\S]*)$/);
	if (!match) {
		throw new Error("pac-slidedeck SKILL.md must contain YAML frontmatter");
	}
	return match[1].trim();
}

export function buildPiSlidedeckPrompt(
	input: string,
	options: { sessionDeckDir?: string; currentDeckPath?: string; pendingDeckPath?: string } = {},
): string {
	return [
		"Apply the canonical presentation-design guidance, then follow the Pi-specific HTML workflow below.",
		"",
		"## Canonical presentation guidance",
		getPortableSlidedeckGuidance(),
		"",
		"## Pi-specific HTML workflow",
		buildSlidedeckPrompt(input, options),
	].join("\n");
}
