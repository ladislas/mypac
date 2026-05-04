import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// ─── Types ────────────────────────────────────────────────────────────────────

export type SkillResult = {
	/** Skill instructions with frontmatter stripped. */
	content: string;
	/** Raw YAML frontmatter block (empty string when none is present). */
	frontmatter: string;
};

// ─── Frontmatter parsing ──────────────────────────────────────────────────────

/**
 * Split a skill file's raw text into frontmatter and content.
 * Frontmatter is the YAML block between the opening and closing `---` lines.
 * If no valid frontmatter block is found, `frontmatter` is an empty string
 * and `content` is the full trimmed text.
 */
export function parseSkillContent(raw: string): SkillResult {
	const text = raw.trimStart();

	if (!text.startsWith("---")) {
		return { content: text.trim(), frontmatter: "" };
	}

	const afterOpen = text.slice(3);
	const closeIndex = afterOpen.indexOf("\n---");
	if (closeIndex === -1) {
		return { content: text.trim(), frontmatter: "" };
	}

	const frontmatter = afterOpen.slice(0, closeIndex).trim();
	const content = afterOpen.slice(closeIndex + 4).trim(); // skip "\n---"
	return { frontmatter, content };
}

// ─── Loaders ──────────────────────────────────────────────────────────────────

/**
 * Load and parse a skill from a specific file path.
 * Returns `null` if the file cannot be read.
 */
export async function loadSkillFromPath(filePath: string): Promise<SkillResult | null> {
	try {
		const raw = await fs.readFile(filePath, "utf8");
		if (!raw.trim()) return null;
		return parseSkillContent(raw);
	} catch {
		return null;
	}
}

/**
 * Load a package-owned skill by name.
 * Resolves `skills/<name>/SKILL.md` relative to this package's root.
 * Returns `null` if the skill file is missing or empty.
 */
export async function loadPackageSkill(name: string): Promise<SkillResult | null> {
	const skillPath = path.resolve(currentDir, "..", "skills", name, "SKILL.md");
	return loadSkillFromPath(skillPath);
}
