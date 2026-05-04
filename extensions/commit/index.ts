import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { buildCommitPrompt, buildScopedFiles, parseChangedFiles, parseCommitArgs } from "./scope.ts";
import { loadPackageSkill } from "../../lib/skill-loader.ts";

type ModelRef = {
	provider: string;
	id: string;
};

type CommitFlowState = {
	previousModel?: ModelRef;
};

type CommitExtensionDeps = {
	loadPackageSkill?: typeof loadPackageSkill;
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

export default function commitExtension(pi: ExtensionAPI, deps: CommitExtensionDeps = {}) {
	const loadSkill = deps.loadPackageSkill ?? loadPackageSkill;

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

			const skillResult = await loadSkill("pac-commit");
			if (!skillResult) {
				ctx.ui.notify("Could not load skills/pac-commit/SKILL.md", "error");
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
			pi.sendUserMessage(buildCommitPrompt({ ...options, scopedFiles, skillContent: skillResult.content }));
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
