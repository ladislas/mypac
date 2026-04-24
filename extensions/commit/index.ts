import { existsSync } from "node:fs";
import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

type ModelRef = {
	provider: string;
	id: string;
};

type CommitFlowState = {
	previousModel?: ModelRef;
};

type CommitCommandOptions = {
	includes: string[];
	excludes: string[];
	hint: string;
};

type CommitPromptOptions = CommitCommandOptions & {
	scopedFiles: string[];
};

const CHEAP_MODEL_CANDIDATES: readonly ModelRef[] = [
	{ provider: "openai-codex", id: "gpt-5.4-mini" },
	{ provider: "anthropic", id: "claude-haiku-4-5-20251001" },
] as const;

function formatModel(model?: ModelRef): string {
	return model ? `${model.provider}/${model.id}` : "unknown";
}

function sameModel(left?: ModelRef, right?: ModelRef): boolean {
	return left?.provider === right?.provider && left?.id === right?.id;
}

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

function parseCommitArgs(args: string, cwd: string): CommitCommandOptions {
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

function parseChangedFiles(statusOutput: string): string[] {
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

function buildScopedFiles(changedFiles: string[], options: CommitCommandOptions): string[] {
	return changedFiles.filter((file) => {
		const included = options.includes.length === 0 || options.includes.some((scope) => matchesScope(file, scope));
		const excluded = options.excludes.some((scope) => matchesScope(file, scope));
		return included && !excluded;
	});
}

function buildCommitPrompt(options: CommitPromptOptions): string {
	return [
		"Read and follow the repository commit skill at skills/pac-commit/SKILL.md before committing.",
		"This command is the structured execution wrapper around that shared commit policy.",
		"",
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

export default function commitExtension(pi: ExtensionAPI) {
	let commitFlow: CommitFlowState | undefined;

	pi.registerCommand("commit", {
		description: "Create atomic git commits with optional -i/--include and -e/--exclude scopes",
		handler: async (args, ctx) => {
			if (!ctx.isIdle()) {
				ctx.ui.notify("/commit can only run while the agent is idle", "warning");
				return;
			}

			const repoCheck = await pi.exec("git", ["rev-parse", "--is-inside-work-tree"]);
			if (repoCheck.code !== 0 || repoCheck.stdout.trim() !== "true") {
				ctx.ui.notify("/commit must be run inside a git repository", "error");
				return;
			}

			const status = await pi.exec("git", ["status", "--porcelain", "--untracked-files=all"]);
			if (status.code !== 0) {
				ctx.ui.notify(status.stderr.trim() || "Failed to inspect git status", "error");
				return;
			}

			const changedFiles = parseChangedFiles(status.stdout);
			if (changedFiles.length === 0) {
				ctx.ui.notify("No git changes to commit", "info");
				return;
			}

			const options = parseCommitArgs(args, ctx.cwd);
			const scopedFiles = buildScopedFiles(changedFiles, options);
			if (scopedFiles.length === 0) {
				ctx.ui.notify("No changed files match the requested commit scope", "warning");
				return;
			}

			const previousModel = ctx.model
				? { provider: ctx.model.provider, id: ctx.model.id }
				: undefined;
			let selectedModel = previousModel;
			let switchedModel = false;

			for (const candidate of CHEAP_MODEL_CANDIDATES) {
				const model = ctx.modelRegistry.find(candidate.provider, candidate.id);
				if (!model) {
					continue;
				}

				if (sameModel(previousModel, candidate)) {
					selectedModel = candidate;
					ctx.ui.notify(`Using already-active commit model: ${formatModel(candidate)}`, "info");
					break;
				}

				const success = await pi.setModel(model);
				if (!success) {
					continue;
				}

				selectedModel = candidate;
				switchedModel = true;
				ctx.ui.notify(`Switched to commit model: ${formatModel(candidate)}`, "info");
				break;
			}

			if (!selectedModel) {
				ctx.ui.notify("No current model or cheap commit model is available", "error");
				return;
			}

			if (!switchedModel && !CHEAP_MODEL_CANDIDATES.some((candidate) => sameModel(candidate, selectedModel))) {
				ctx.ui.notify(`No preferred cheap model available; using current model: ${formatModel(selectedModel)}`, "warning");
			}

			if (options.includes.length > 0 || options.excludes.length > 0 || options.hint) {
				const parts = [`Scoped ${scopedFiles.length} changed file${scopedFiles.length === 1 ? "" : "s"}`];
				if (options.includes.length > 0) {
					parts.push(`include: ${options.includes.join(", ")}`);
				}
				if (options.excludes.length > 0) {
					parts.push(`exclude: ${options.excludes.join(", ")}`);
				}
				if (options.hint) {
					parts.push(`hint: ${options.hint}`);
				}
				ctx.ui.notify(parts.join(" | "), "info");
			}

			commitFlow = { previousModel };
			pi.sendUserMessage(buildCommitPrompt({ ...options, scopedFiles }));
		},
	});

	pi.on("agent_end", async (_event, ctx) => {
		const flow = commitFlow;
		if (!flow) {
			return;
		}

		commitFlow = undefined;

		if (!flow.previousModel) {
			return;
		}

		const currentModel = ctx.model
			? { provider: ctx.model.provider, id: ctx.model.id }
			: undefined;

		if (sameModel(currentModel, flow.previousModel)) {
			ctx.ui.notify(`Restored model: ${formatModel(flow.previousModel)}`, "info");
			return;
		}

		const restoreTarget = ctx.modelRegistry.find(flow.previousModel.provider, flow.previousModel.id);
		if (!restoreTarget) {
			ctx.ui.notify(`Commit flow finished, but could not find previous model: ${formatModel(flow.previousModel)}`, "warning");
			return;
		}

		const restored = await pi.setModel(restoreTarget);
		if (restored) {
			ctx.ui.notify(`Restored model: ${formatModel(flow.previousModel)}`, "info");
			return;
		}

		ctx.ui.notify(`Commit flow finished, but failed to restore model: ${formatModel(flow.previousModel)}`, "warning");
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		const flow = commitFlow;
		commitFlow = undefined;
		if (!flow?.previousModel) {
			return;
		}

		const currentModel = ctx.model
			? { provider: ctx.model.provider, id: ctx.model.id }
			: undefined;
		if (sameModel(currentModel, flow.previousModel)) {
			return;
		}

		const restoreTarget = ctx.modelRegistry.find(flow.previousModel.provider, flow.previousModel.id);
		if (!restoreTarget) {
			return;
		}

		await pi.setModel(restoreTarget);
	});
}
