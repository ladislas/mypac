import { existsSync } from "node:fs";
import path from "node:path";

export type CommitCommandOptions = {
	includes: string[];
	excludes: string[];
	hint: string;
};

export type CommitPromptOptions = CommitCommandOptions & {
	scopedFiles: string[];
	skillContent: string;
};

function normalizeRepoPath(input: string): string {
	const normalized = path.normalize(input).replace(/\\/g, "/");
	if (normalized === ".") {
		return normalized;
	}
	return normalized.replace(/^\.\//, "").replace(/\/$/, "");
}

function toRepoRelativePath(input: string, cwd: string): string {
	const absolute = path.isAbsolute(input) ? input : path.resolve(cwd, input);
	const relative = path.relative(cwd, absolute);
	return normalizeRepoPath(relative);
}

function tokenizeArgs(args: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let quote: '"' | "'" | undefined;

	for (let i = 0; i < args.length; i += 1) {
		const char = args[i];

		if (quote) {
			if (char === quote) {
				quote = undefined;
				continue;
			}
			if (char === "\\" && i + 1 < args.length) {
				i += 1;
				current += args[i];
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
			if (current) {
				tokens.push(current);
				current = "";
			}
			continue;
		}

		if (char === "\\" && i + 1 < args.length) {
			i += 1;
			current += args[i];
			continue;
		}

		current += char;
	}

	if (current) {
		tokens.push(current);
	}

	return tokens;
}

export function parseCommitArgs(args: string, cwd: string): CommitCommandOptions {
	const tokens = tokenizeArgs(args);
	const includes: string[] = [];
	const excludes: string[] = [];
	const hintTokens: string[] = [];

	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index];
		const next = tokens[index + 1];

		if ((token === "--include" || token === "-i") && next) {
			includes.push(toRepoRelativePath(next, cwd));
			index += 1;
			continue;
		}

		if ((token === "--exclude" || token === "-e") && next) {
			excludes.push(toRepoRelativePath(next, cwd));
			index += 1;
			continue;
		}

		if (token.startsWith("--include=")) {
			includes.push(toRepoRelativePath(token.slice("--include=".length), cwd));
			continue;
		}

		if (token.startsWith("--exclude=")) {
			excludes.push(toRepoRelativePath(token.slice("--exclude=".length), cwd));
			continue;
		}

		const candidatePath = path.isAbsolute(token) ? token : path.resolve(cwd, token);
		if (existsSync(candidatePath)) {
			includes.push(toRepoRelativePath(candidatePath, cwd));
			continue;
		}

		hintTokens.push(token);
	}

	return {
		includes: [...new Set(includes)],
		excludes: [...new Set(excludes)],
		hint: hintTokens.join(" ").trim(),
	};
}

export function parseChangedFiles(statusOutput: string): string[] {
	const files = new Set<string>();

	for (const line of statusOutput.split("\n")) {
		if (!line.trim()) {
			continue;
		}

		const rawPath = line.slice(3).trim();
		const targetPath = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1) ?? rawPath : rawPath;
		files.add(normalizeRepoPath(targetPath));
	}

	return [...files];
}

function matchesScope(file: string, scope: string): boolean {
	if (scope === ".") {
		return true;
	}
	return file === scope || file.startsWith(`${scope}/`);
}

export function buildScopedFiles(changedFiles: string[], options: CommitCommandOptions): string[] {
	return changedFiles.filter((file) => {
		const included = options.includes.length === 0 || options.includes.some((scope) => matchesScope(file, scope));
		const excluded = options.excludes.some((scope) => matchesScope(file, scope));
		return included && !excluded;
	});
}

export function buildCommitPrompt(options: CommitPromptOptions): string {
	return [
		options.skillContent.trim(),
		"",
		"---",
		"",
		"This command is the structured execution wrapper around the commit skill above.",
		"Create one or more atomic git commits following the project's gitmoji conventions.",
		"",
		"Format:",
		"<emoji> <type>(<scope>): <summary>",
		"Scope is optional: <emoji> <type>: <summary>",
		"Example: ✨ feat(auth): Add user authentication system",
		"",
		"Workflow:",
		"1. Inspect the repository state with git branch --show-current, git status, and git diff.",
		"2. Follow skills/pac-commit/SKILL.md for branch safety, gitmoji shortlist selection, atomic grouping, OpenSpec slice rules, explicit staging, and GitHub issue closing references.",
		"3. Inspect the current conversation context and any user hint for explicit GitHub issue URLs or issue numbers.",
		"4. Restrict your analysis and commit staging to the scoped files listed below.",
		"5. Group the scoped changes into logical, atomic units. Unrelated changes belong in separate commits.",
		"6. If there is more than one unrelated commit group, STOP and present the proposed split for approval before committing anything.",
		"7. For each approved commit group:",
		"   - Choose the most appropriate emoji from the shortlist in skills/pac-commit/SKILL.md.",
		"   - If needed and available, run gitmoji list for the full catalog.",
		"   - Select the file list for that commit explicitly.",
		"   - Stage only the files for that logical unit.",
		"   - Verify the staged file list matches the intended commit.",
		"   - Use one emoji and one primary purpose for the commit; if the change is breaking, prefer 💥 and explain the migration in the body.",
		"   - Commit with the format <emoji> <type>(<scope>): <summary> or <emoji> <type>: <summary> when no scope is needed.",
		"   - Add a body when needed to explain why, tradeoffs, issue references, or migration notes.",
		"   - If the work is explicitly tied to a GitHub issue, add `closes #<issue>` to the commit body that should close it when merged. For OpenSpec planning commits, that closing reference must appear in the first plan commit.",
		"   - If you use a fixup workflow, create the fixup commit first, then stop and wait for explicit user confirmation before running any autosquash rebase.",
		"8. Report each resulting commit hash and message.",
		"",
		"Constraints:",
		"- Never use --no-verify.",
		"- Do not commit directly on main; pause and ask if the current branch is main.",
		"- Keep summaries concise, imperative, and without a trailing period.",
		"- Use one emoji and one primary purpose per commit.",
		"- Use a conventional type such as feat, fix, docs, refactor, test, chore, or perf.",
		"- Scope should be a short lowercase noun when used, such as git, docs, ui, deps, or agent.",
		"- If a body is needed, use it for why, tradeoffs, issue references, or migration notes rather than restating the diff.",
		"- Do not guess or invent GitHub issue numbers; only use issues explicitly present in the conversation or hint.",
		"- Do not stage or commit files outside the scoped file list below.",
		"- Do not sweep unrelated staged files into a commit just because they were already staged.",
		"- If a commit hook fails, report the failure clearly and do not bypass it.",
		"- At the end, summarize what happened, including any commits created or any reason you stopped.",
		"",
		"Scoped changed files:",
		...options.scopedFiles.map((file) => `- ${file}`),
		options.includes.length > 0 ? "" : undefined,
		options.includes.length > 0 ? "Requested include scopes:" : undefined,
		...options.includes.map((scope) => `- ${scope}`),
		options.excludes.length > 0 ? "" : undefined,
		options.excludes.length > 0 ? "Requested exclude scopes:" : undefined,
		...options.excludes.map((scope) => `- ${scope}`),
		options.hint ? "" : undefined,
		options.hint ? `Hint from user: ${options.hint}` : undefined,
	]
		.filter((line): line is string => line !== undefined)
		.join("\n");
}
