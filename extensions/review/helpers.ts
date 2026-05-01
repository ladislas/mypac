import path from "node:path";
import { promises as fs } from "node:fs";
import { buildWorkflowSessionName } from "../session-names/helpers.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReviewTarget =
	| { type: "uncommitted" }
	| { type: "baseBranch"; branch: string }
	| { type: "commit"; sha: string; title?: string }
	| { type: "pullRequest"; prNumber: number; baseBranch: string; title: string }
	| { type: "folder"; paths: string[] };

export type ParsedReviewArgs = {
	target: ReviewTarget | { type: "pr"; ref: string } | null;
	extraInstruction?: string;
	error?: string;
};

export type ReviewFixWorkflow = "fixup" | "staged";

// ─── Prompt templates ─────────────────────────────────────────────────────────

export const UNCOMMITTED_PROMPT =
	"Review the current code changes (staged, unstaged, and untracked files) and provide prioritized findings.";

export const LOCAL_CHANGES_REVIEW_INSTRUCTIONS =
	"Also include local working-tree changes (staged, unstaged, and untracked files) from this branch. Use `git status --porcelain`, `git diff`, `git diff --staged`, and `git ls-files --others --exclude-standard` so local fixes are part of this review cycle.";

export const BASE_BRANCH_PROMPT_WITH_MERGE_BASE =
	"Review the code changes against the base branch '{baseBranch}'. The merge base commit for this comparison is {mergeBaseSha}. Run `git diff {mergeBaseSha}` to inspect the changes relative to {baseBranch}. Provide prioritized, actionable findings.";

export const BASE_BRANCH_PROMPT_FALLBACK =
	"Review the code changes against the base branch '{branch}'. Start by finding the merge diff between the current branch and {branch}'s upstream e.g. (`git merge-base HEAD \"$(git rev-parse --abbrev-ref \"{branch}@{upstream}\")\"`), then run `git diff` against that SHA to see what changes we would merge into the {branch} branch. Provide prioritized, actionable findings.";

export const COMMIT_PROMPT_WITH_TITLE =
	'Review the code changes introduced by commit {sha} ("{title}"). Provide prioritized, actionable findings.';

export const COMMIT_PROMPT = "Review the code changes introduced by commit {sha}. Provide prioritized, actionable findings.";

export const PULL_REQUEST_PROMPT =
	'Review pull request #{prNumber} ("{title}") against the base branch \'{baseBranch}\'. The merge base commit for this comparison is {mergeBaseSha}. Run `git diff {mergeBaseSha}` to inspect the changes that would be merged. Provide prioritized, actionable findings.';

export const PULL_REQUEST_PROMPT_FALLBACK =
	'Review pull request #{prNumber} ("{title}") against the base branch \'{baseBranch}\'. Start by finding the merge base between the current branch and {baseBranch} (e.g., `git merge-base HEAD {baseBranch}`), then run `git diff` against that SHA to see the changes that would be merged. Provide prioritized, actionable findings.';

export const FOLDER_REVIEW_PROMPT =
	"Review the code in the following paths: {paths}. This is a snapshot review (not a diff). Read the files directly in these paths and provide prioritized, actionable findings.";

export function getReviewFixWorkflow(targetType?: ReviewTarget["type"]): ReviewFixWorkflow {
	if (targetType === "uncommitted" || targetType === "folder" || targetType === undefined) {
		return "staged";
	}

	return "fixup";
}

function getReviewModeLabel(targetType?: ReviewTarget["type"]): string {
	switch (targetType) {
		case "uncommitted":
			return "uncommitted changes";
		case "baseBranch":
			return "base branch";
		case "commit":
			return "commit";
		case "pullRequest":
			return "pull request";
		case "folder":
			return "folder snapshot";
		default:
			return "unknown";
	}
}

export function buildReviewFixFindingsPrompt(targetType?: ReviewTarget["type"]): string {
	const workflow = getReviewFixWorkflow(targetType);
	const reviewModeLabel = getReviewModeLabel(targetType);
	const commitDisciplineIntro =
		targetType === undefined
			? "The original review mode is unavailable. Use the staging workflow below so you do not create accidental commits."
			: `This review was started in ${reviewModeLabel} mode. Use the ${workflow === "fixup" ? "fixup" : "staging"} workflow below.`;
	const workflowInstructions = workflow === "fixup"
		? `**Fixup workflow:**
After each fix is applied:
1. Before editing the file, run \`git blame <file> -L <start>,<end>\` to identify the commit that introduced the code being fixed.
2. Stage the change: \`git add <file>\`
3. Create an atomic fixup commit: \`git commit --fixup <sha>\`
Do NOT run \`git rebase --autosquash\` — that is the user's decision.`
		: `**Staging workflow:**
For each file being fixed:
1. Stage its current state before editing: \`git add <file>\`
2. Apply the fix. The unstaged diff now shows exactly what changed.
Do NOT commit. Leave the files staged/unstaged for the user to handle.`;

	return `Use the latest review summary in this session and implement the review findings now.

## Commit discipline

${commitDisciplineIntro}
Do not inspect repository history to switch workflows mid-run.

${workflowInstructions}

## Fix instructions

1. Treat the summary's Findings/Fix Queue as a checklist.
2. Fix in priority order: P0, P1, then P2 (include P3 if quick and safe).
3. If a finding is invalid/already fixed/not possible right now, briefly explain why and continue.
4. Treat "Human Reviewer Callouts (Non-Blocking)" as informational only; do not convert them into fix tasks unless there is a separate explicit finding.
5. Follow fail-fast error handling: do not add local catch/fallback recovery unless this scope is an explicit boundary that can safely translate the failure.
6. If you add or keep a \`try/catch\`, explain the expected failure mode and either rethrow with context or return a boundary-safe error response.
7. JSON parsing/decoding should fail loudly by default; avoid silent fallback parsing.
8. Run relevant tests/checks for touched code where practical.

## After all fixes

1. List every ${workflow === "fixup" ? "fixup commit created" : "file prepared"}: what was fixed${workflow === "fixup" ? ", and which original commit it targets" : ""}.
2. List fixed items, deferred/skipped items (with reasons), and verification results.
3. Ask the user for next steps:
   - Continue with more fixes
   - ${workflow === "fixup"
			? "Run \`git rebase --autosquash\` to fold all fixups in (requires explicit user approval before executing)"
			: "Review or commit the staged/unstaged changes manually"}
   - Stop and leave ${workflow === "fixup" ? "fixup commits" : "the prepared changes"} as-is`;
}

// ─── Skill loading ────────────────────────────────────────────────────────────

/**
 * Walks up from cwd until a .pi directory is found, then loads
 * skills/pac-review/SKILL.md from that same directory.
 * Returns null if the skill file is not found.
 */
export async function loadReviewSkill(cwd: string): Promise<string | null> {
	let currentDir = path.resolve(cwd);

	while (true) {
		const piDir = path.join(currentDir, ".pi");
		const piStats = await fs.stat(piDir).catch(() => null);

		if (piStats?.isDirectory()) {
			const skillPath = path.join(currentDir, "skills", "pac-review", "SKILL.md");
			try {
				const content = await fs.readFile(skillPath, "utf8");
				return content.trim() || null;
			} catch {
				return null;
			}
		}

		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) return null;
		currentDir = parentDir;
	}
}

// ─── Findings analysis ────────────────────────────────────────────────────────

export function parseMarkdownHeading(line: string): { level: number; title: string } | null {
	const headingMatch = line.match(/^\s*(#{1,6})\s+(.+?)\s*$/);
	if (!headingMatch) {
		return null;
	}

	const rawTitle = headingMatch[2].replace(/\s+#+\s*$/, "").trim();
	return {
		level: headingMatch[1].length,
		title: rawTitle,
	};
}

export function getFindingsSectionBounds(lines: string[]): { start: number; end: number } | null {
	let start = -1;
	let findingsHeadingLevel: number | null = null;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const heading = parseMarkdownHeading(line);
		if (heading && /^findings\b/i.test(heading.title)) {
			start = i + 1;
			findingsHeadingLevel = heading.level;
			break;
		}
		if (/^\s*findings\s*:?\s*$/i.test(line)) {
			start = i + 1;
			break;
		}
	}

	if (start < 0) {
		return null;
	}

	let end = lines.length;
	for (let i = start; i < lines.length; i++) {
		const line = lines[i];
		const heading = parseMarkdownHeading(line);
		if (heading) {
			const normalizedTitle = heading.title.replace(/[*_`]/g, "").trim();
			if (/^(review scope|verdict|overall verdict|fix queue|constraints(?:\s*&\s*preferences)?)\b:?/i.test(normalizedTitle)) {
				end = i;
				break;
			}

			if (/\[P[0-3]\]/i.test(heading.title)) {
				continue;
			}

			if (findingsHeadingLevel !== null && heading.level <= findingsHeadingLevel) {
				end = i;
				break;
			}
		}

		if (/^\s*(review scope|verdict|overall verdict|fix queue|constraints(?:\s*&\s*preferences)?)\b:?/i.test(line)) {
			end = i;
			break;
		}
	}

	return { start, end };
}

export function isLikelyFindingLine(line: string): boolean {
	if (!/\[P[0-3]\]/i.test(line)) {
		return false;
	}

	if (/^\s*(?:[-*+]|(?:\d+)[.)]|#{1,6})\s+priority\s+tag\b/i.test(line)) {
		return false;
	}

	if (/^\s*(?:[-*+]|(?:\d+)[.)]|#{1,6})\s+\[P[0-3]\]\s*-\s*(?:drop everything|urgent|normal|low|nice to have)\b/i.test(line)) {
		return false;
	}

	const allPriorityTags = line.match(/\[P[0-3]\]/gi) ?? [];
	if (allPriorityTags.length > 1) {
		return false;
	}

	if (/^\s*(?:[-*+]|(?:\d+)[.)])\s+/.test(line)) {
		return true;
	}

	if (/^\s*#{1,6}\s+/.test(line)) {
		return true;
	}

	if (/^\s*(?:\*\*|__)?\[P[0-3]\](?:\*\*|__)?(?=\s|:|-)/i.test(line)) {
		return true;
	}

	return false;
}

export function normalizeVerdictValue(value: string): string {
	return value
		.trim()
		.replace(/^[-*+]\s*/, "")
		.replace(/^['"`]+|['"`]+$/g, "")
		.toLowerCase();
}

export function isNeedsAttentionVerdictValue(value: string): boolean {
	const normalized = normalizeVerdictValue(value);
	if (!normalized.includes("needs attention")) {
		return false;
	}

	if (/\bnot\s+needs\s+attention\b/.test(normalized)) {
		return false;
	}

	// Reject rubric/choice phrasing like "correct or needs attention", but
	// keep legitimate verdict text that may contain unrelated "or".
	if (/\bcorrect\b/.test(normalized) && /\bor\b/.test(normalized)) {
		return false;
	}

	return true;
}

export function hasNeedsAttentionVerdict(messageText: string): boolean {
	const lines = messageText.split(/\r?\n/);

	for (const line of lines) {
		const inlineMatch = line.match(/^\s*(?:[*-+]\s*)?(?:overall\s+)?verdict\s*:\s*(.+)$/i);
		if (inlineMatch && isNeedsAttentionVerdictValue(inlineMatch[1])) {
			return true;
		}
	}

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const heading = parseMarkdownHeading(line);

		let verdictLevel: number | null = null;
		if (heading) {
			const normalizedHeading = heading.title.replace(/[*_`]/g, "").trim();
			if (!/^(?:overall\s+)?verdict\b/i.test(normalizedHeading)) {
				continue;
			}
			verdictLevel = heading.level;
		} else if (!/^\s*(?:overall\s+)?verdict\s*:?\s*$/i.test(line)) {
			continue;
		}

		for (let j = i + 1; j < lines.length; j++) {
			const verdictLine = lines[j];
			const nextHeading = parseMarkdownHeading(verdictLine);
			if (nextHeading) {
				const normalizedNextHeading = nextHeading.title.replace(/[*_`]/g, "").trim();
				if (verdictLevel === null || nextHeading.level <= verdictLevel) {
					break;
				}
				if (/^(review scope|findings|fix queue|constraints(?:\s*&\s*preferences)?)\b:?/i.test(normalizedNextHeading)) {
					break;
				}
			}

			const trimmed = verdictLine.trim();
			if (!trimmed) {
				continue;
			}

			if (isNeedsAttentionVerdictValue(trimmed)) {
				return true;
			}

			if (/\bcorrect\b/i.test(normalizeVerdictValue(trimmed))) {
				break;
			}
		}
	}

	return false;
}

export function hasBlockingReviewFindings(messageText: string): boolean {
	const lines = messageText.split(/\r?\n/);
	const bounds = getFindingsSectionBounds(lines);
	const candidateLines = bounds ? lines.slice(bounds.start, bounds.end) : lines;

	let inCodeFence = false;
	let foundTaggedFinding = false;
	for (const line of candidateLines) {
		if (/^\s*```/.test(line)) {
			inCodeFence = !inCodeFence;
			continue;
		}
		if (inCodeFence) {
			continue;
		}

		if (!isLikelyFindingLine(line)) {
			continue;
		}

		foundTaggedFinding = true;
		if (/\[(P0|P1|P2)\]/i.test(line)) {
			return true;
		}
	}

	if (foundTaggedFinding) {
		return false;
	}

	return hasNeedsAttentionVerdict(messageText);
}

// ─── Argument parsing ─────────────────────────────────────────────────────────

export function parseReviewPaths(value: string): string[] {
	return value
		.split(/\s+/)
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

export function parsePrReference(ref: string): number | null {
	const trimmed = ref.trim();

	const num = parseInt(trimmed, 10);
	if (!isNaN(num) && num > 0) {
		return num;
	}

	// Formats: https://github.com/owner/repo/pull/123
	//          github.com/owner/repo/pull/123
	const urlMatch = trimmed.match(/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/);
	if (urlMatch) {
		return parseInt(urlMatch[1], 10);
	}

	return null;
}

export function tokenizeArgs(value: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let quote: '"' | "'" | null = null;

	for (let i = 0; i < value.length; i++) {
		const char = value[i];

		if (quote) {
			if (char === "\\" && i + 1 < value.length) {
				current += value[i + 1];
				i += 1;
				continue;
			}
			if (char === quote) {
				quote = null;
				continue;
			}
			current += char;
			continue;
		}

		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}

		if (/\s/.test(char)) {
			if (current.length > 0) {
				tokens.push(current);
				current = "";
			}
			continue;
		}

		current += char;
	}

	if (current.length > 0) {
		tokens.push(current);
	}

	return tokens;
}

export function parseArgs(args: string | undefined): ParsedReviewArgs {
	if (!args?.trim()) return { target: null };

	const rawParts = tokenizeArgs(args.trim());
	const parts: string[] = [];
	let extraInstruction: string | undefined;

	for (let i = 0; i < rawParts.length; i++) {
		const part = rawParts[i];
		if (part === "--extra") {
			const next = rawParts[i + 1];
			if (!next) {
				return { target: null, error: "Missing value for --extra" };
			}
			extraInstruction = next;
			i += 1;
			continue;
		}

		if (part.startsWith("--extra=")) {
			extraInstruction = part.slice("--extra=".length);
			continue;
		}

		parts.push(part);
	}

	// Helper: build result without undefined properties for clean deepEqual comparisons.
	function result(target: ParsedReviewArgs["target"]): ParsedReviewArgs {
		return extraInstruction !== undefined ? { target, extraInstruction } : { target };
	}

	if (parts.length === 0) {
		return result(null);
	}

	const subcommand = parts[0]?.toLowerCase();

	switch (subcommand) {
		case "uncommitted":
			return result({ type: "uncommitted" });

		case "branch": {
			const branch = parts[1];
			if (!branch) return result(null);
			return result({ type: "baseBranch", branch });
		}

		case "commit": {
			const sha = parts[1];
			if (!sha) return result(null);
			const title = parts.slice(2).join(" ") || undefined;
			const commitTarget: ReviewTarget = title !== undefined ? { type: "commit", sha, title } : { type: "commit", sha };
			return result(commitTarget);
		}

		case "folder": {
			const paths = parseReviewPaths(parts.slice(1).join(" "));
			if (paths.length === 0) return result(null);
			return result({ type: "folder", paths });
		}

		case "pr": {
			const ref = parts[1];
			if (!ref) return result(null);
			return result({ type: "pr", ref });
		}

		default:
			return result(null);
	}
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export function getUserFacingHint(target: ReviewTarget): string {
	switch (target.type) {
		case "uncommitted":
			return "current changes";
		case "baseBranch":
			return `changes against '${target.branch}'`;
		case "commit": {
			const shortSha = target.sha.slice(0, 7);
			return target.title ? `commit ${shortSha}: ${target.title}` : `commit ${shortSha}`;
		}
		case "pullRequest": {
			const shortTitle = target.title.length > 30 ? target.title.slice(0, 27) + "..." : target.title;
			return `PR #${target.prNumber}: ${shortTitle}`;
		}
		case "folder": {
			const joined = target.paths.join(", ");
			return joined.length > 40 ? `folders: ${joined.slice(0, 37)}...` : `folders: ${joined}`;
		}
	}
}

export function buildReviewSessionName(target: ReviewTarget): string | undefined {
	switch (target.type) {
		case "uncommitted":
			return buildWorkflowSessionName("review", "uncommitted");
		case "baseBranch":
			return buildWorkflowSessionName("review", target.branch);
		case "commit": {
			const shortSha = target.sha.slice(0, 7);
			const label = target.title ? `${shortSha}: ${target.title}` : shortSha;
			return buildWorkflowSessionName("review", label);
		}
		case "pullRequest":
			return buildWorkflowSessionName("review", `PR #${target.prNumber}: ${target.title}`);
		case "folder":
			return buildWorkflowSessionName("review", target.paths.join(", "));
	}
}
