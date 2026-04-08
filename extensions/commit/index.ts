import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

type ModelRef = {
	provider: string;
	id: string;
};

type CommitFlowState = {
	previousModel?: ModelRef;
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

function buildCommitPrompt(args: string): string {
	const hint = args.trim();

	return [
		"Create one or more atomic git commits following the project's gitmoji conventions.",
		"",
		"Format:",
		"<emoji> (<topic>): <message>",
		"Example: 🎉 (git): Initial commit",
		"",
		"Workflow:",
		"1. Inspect the repository state with git status and git diff.",
		"2. Group the changes into logical, atomic units. Unrelated changes belong in separate commits.",
		"3. If there is more than one unrelated commit group, STOP and present the proposed split for approval before committing anything.",
		"4. For each approved commit group:",
		"   - Run gitmoji list to choose the most appropriate emoji.",
		"   - Select the file list for that commit explicitly.",
		"   - Stage only the files for that logical unit.",
		"   - Verify the staged file list matches the intended commit.",
		"   - Commit with the format <emoji> (<topic>): <message>.",
		"5. Report each resulting commit hash and message.",
		"",
		"Constraints:",
		"- Never use --no-verify.",
		"- Keep messages concise, imperative, and without a trailing period.",
		"- Topic should be a short lowercase noun such as git, docs, ui, deps, or agent.",
		"- Do not sweep unrelated staged files into a commit just because they were already staged.",
		"- If a commit hook fails, report the failure clearly and do not bypass it.",
		"- At the end, summarize what happened, including any commits created or any reason you stopped.",
		hint ? "" : undefined,
		hint ? `Hint from user: ${hint}` : undefined,
	]
		.filter((line): line is string => line !== undefined)
		.join("\n");
}

export default function commitExtension(pi: ExtensionAPI) {
	let commitFlow: CommitFlowState | undefined;

	pi.registerCommand("commit", {
		description: "Create atomic git commits with temporary cheap-model routing",
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

			const status = await pi.exec("git", ["status", "--porcelain"]);
			if (status.code !== 0) {
				ctx.ui.notify(status.stderr.trim() || "Failed to inspect git status", "error");
				return;
			}

			if (!status.stdout.trim()) {
				ctx.ui.notify("No git changes to commit", "info");
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

			commitFlow = { previousModel };

			pi.sendUserMessage(buildCommitPrompt(args));
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
