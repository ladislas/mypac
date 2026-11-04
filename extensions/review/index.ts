/**
 * Code Review Extension
 *
 * Provides a `/review-start` command that prompts the agent to review code changes.
 * Supports two review modes:
 * - Review uncommitted changes
 * - Review against a base branch (PR style)
 *
 * Review guidelines live in skills/pac-review/SKILL.md and are injected into
 * the prompt at review time. Users can also invoke the skill directly in
 * conversation without using this extension.
 *
 * Usage:
 * - `/review-start` - show interactive selector
 * - `/review-start uncommitted` - review uncommitted changes directly
 * - `/review-start branch main` - review against main branch
 * - `/review-start --extra "focus on performance regressions"` - add extra review instruction
 *
 * Project-specific review guidelines:
 * - In trusted projects, if REVIEW_GUIDELINES.md exists beside Pi's project
 *   configuration directory, its contents are appended to the review prompt.
 *
 * Note: The extension opens a fresh session branch for the review and
 * provides /review-end to return to the original position.
 */

import type { ExtensionAPI, ExtensionContext, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME, DynamicBorder, BorderedLoader } from "@earendil-works/pi-coding-agent";
import {
	Container,
	fuzzyFilter,
	Input,
	type SelectItem,
	SelectList,
	Spacer,
	Text,
} from "@earendil-works/pi-tui";
import path from "node:path";
import { promises as fs } from "node:fs";
import { loadPackageSkill } from "../../lib/skill-loader.ts";
import {
	formatReviewPromptError,
	loadReviewFixFindingsPrompt as defaultLoadReviewFixFindingsPrompt,
	loadReviewSummaryPrompt as defaultLoadReviewSummaryPrompt,
} from "./prompts.ts";
import {
	type ReviewTarget,
	UNCOMMITTED_PROMPT,
	BASE_BRANCH_PROMPT_WITH_MERGE_BASE,
	BASE_BRANCH_PROMPT_FALLBACK,
	parseArgs,
	getUserFacingHint,
	buildReviewSessionName,
	buildReviewFixFindingsPrompt,
} from "./helpers.ts";

// State to track fresh-session review origin (where we started from).
// Module-level state means only one review can be active at a time.
// This is intentional - the UI and /review-end command assume a single active review.
let reviewOriginId: string | undefined = undefined;
let endReviewInProgress = false;

const REVIEW_STATE_TYPE = "review-session";
const REVIEW_ANCHOR_TYPE = "review-anchor";

type ReviewExtensionDeps = {
	loadPackageSkill?: typeof loadPackageSkill;
	loadReviewSummaryPrompt?: typeof defaultLoadReviewSummaryPrompt;
	loadReviewFixFindingsPrompt?: typeof defaultLoadReviewFixFindingsPrompt;
};

type ReviewSessionState = {
	active: boolean;
	originId?: string;
	targetType?: ReviewTarget["type"];
};

type OptionalReviewInstructionResult =
	| { cancelled: true }
	| { cancelled: false; instruction?: string };

function setReviewWidget(ctx: ExtensionContext, active: boolean) {
	if (!ctx.hasUI) return;
	if (!active) {
		ctx.ui.setWidget("review", undefined);
		return;
	}

	const message = "Review session active, return with /review-end";
	if (ctx.mode !== "tui") {
		ctx.ui.setWidget("review", [message]);
		return;
	}

	ctx.ui.setWidget("review", (_tui, theme) => {
		const text = new Text(theme.fg("warning", message), 0, 0);
		return {
			render(width: number) {
				return text.render(width);
			},
			invalidate() {
				text.invalidate();
			},
		};
	});
}

function getReviewState(ctx: ExtensionContext): ReviewSessionState | undefined {
	let state: ReviewSessionState | undefined;
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type === "custom" && entry.customType === REVIEW_STATE_TYPE) {
			state = entry.data as ReviewSessionState | undefined;
		}
	}

	return state;
}

function applyReviewState(ctx: ExtensionContext) {
	const state = getReviewState(ctx);

	if (state?.active && state.originId) {
		reviewOriginId = state.originId;
		setReviewWidget(ctx, true);
		return;
	}

	reviewOriginId = undefined;
	setReviewWidget(ctx, false);
}

async function loadProjectReviewGuidelines(cwd: string): Promise<string | null> {
	let currentDir = path.resolve(cwd);

	while (true) {
		const configDir = path.join(currentDir, CONFIG_DIR_NAME);
		const guidelinesPath = path.join(currentDir, "REVIEW_GUIDELINES.md");

		const configStats = await fs.stat(configDir).catch(() => null);
		if (configStats?.isDirectory()) {
			const guidelineStats = await fs.stat(guidelinesPath).catch(() => null);
			if (guidelineStats?.isFile()) {
				try {
					const content = await fs.readFile(guidelinesPath, "utf8");
					const trimmed = content.trim();
					return trimmed ? trimmed : null;
				} catch {
					return null;
				}
			}
			return null;
		}

		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) {
			return null;
		}
		currentDir = parentDir;
	}
}

/**
 * Get the merge base between HEAD and a branch
 */
async function getMergeBase(
	pi: ExtensionAPI,
	branch: string,
): Promise<string | null> {
	try {
		// First try to get the upstream tracking branch
		const { stdout: upstream, code: upstreamCode } = await pi.exec("git", [
			"rev-parse",
			"--abbrev-ref",
			`${branch}@{upstream}`,
		]);

		if (upstreamCode === 0 && upstream.trim()) {
			const { stdout: mergeBase, code } = await pi.exec("git", ["merge-base", "HEAD", upstream.trim()]);
			if (code === 0 && mergeBase.trim()) {
				return mergeBase.trim();
			}
		}

		// Fall back to using the branch directly
		const { stdout: mergeBase, code } = await pi.exec("git", ["merge-base", "HEAD", branch]);
		if (code === 0 && mergeBase.trim()) {
			return mergeBase.trim();
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Get list of local branches
 */
async function getLocalBranches(pi: ExtensionAPI): Promise<string[]> {
	const { stdout, code } = await pi.exec("git", ["branch", "--format=%(refname:short)"]);
	if (code !== 0) return [];
	return stdout
		.trim()
		.split("\n")
		.filter((b) => b.trim());
}

/**
 * Get the current branch name
 */
async function getCurrentBranch(pi: ExtensionAPI): Promise<string | null> {
	const { stdout, code } = await pi.exec("git", ["branch", "--show-current"]);
	if (code === 0 && stdout.trim()) {
		return stdout.trim();
	}
	return null;
}

/**
 * Get the default branch (main or master)
 */
async function getDefaultBranch(pi: ExtensionAPI): Promise<string> {
	// Try to get from remote HEAD
	const { stdout, code } = await pi.exec("git", ["symbolic-ref", "refs/remotes/origin/HEAD", "--short"]);
	if (code === 0 && stdout.trim()) {
		return stdout.trim().replace("origin/", "");
	}

	// Fall back to checking if main or master exists
	const branches = await getLocalBranches(pi);
	if (branches.includes("main")) return "main";
	if (branches.includes("master")) return "master";

	return "main"; // Default fallback
}

/**
 * Build the diff-specific part of the review prompt based on target.
 * The review skill/rubric is prepended separately in executeReview.
 */
async function buildReviewPrompt(
	pi: ExtensionAPI,
	target: ReviewTarget,
): Promise<string> {
	switch (target.type) {
		case "uncommitted":
			return UNCOMMITTED_PROMPT;

		case "baseBranch": {
			const mergeBase = await getMergeBase(pi, target.branch);
			return mergeBase
				? BASE_BRANCH_PROMPT_WITH_MERGE_BASE.replace(/{baseBranch}/g, target.branch).replace(/{mergeBaseSha}/g, mergeBase)
				: BASE_BRANCH_PROMPT_FALLBACK.replace(/{branch}/g, target.branch);
		}
	}
}

// Review preset options for the selector
const REVIEW_PRESETS = [
	{ value: "baseBranch", label: "Review against a base branch", description: "(local)" },
	{ value: "uncommitted", label: "Review uncommitted changes", description: "" },
] as const;

type ReviewPresetValue = (typeof REVIEW_PRESETS)[number]["value"];

export default function reviewExtension(pi: ExtensionAPI, deps: ReviewExtensionDeps = {}) {
	const loadSkill = deps.loadPackageSkill ?? loadPackageSkill;
	const loadReviewSummaryPrompt = deps.loadReviewSummaryPrompt ?? defaultLoadReviewSummaryPrompt;
	const loadReviewFixFindingsPrompt = deps.loadReviewFixFindingsPrompt ?? defaultLoadReviewFixFindingsPrompt;

	async function promptForOptionalReviewInstruction(ctx: ExtensionContext): Promise<OptionalReviewInstructionResult> {
		if (ctx.mode !== "tui") {
			const instruction = await ctx.ui.input(
				"Optional review instruction",
				"Leave empty to skip",
			);
			return instruction === undefined
				? { cancelled: true }
				: { cancelled: false, instruction: instruction.trim() || undefined };
		}

		return await ctx.ui.custom<OptionalReviewInstructionResult>((tui, theme, _keybindings, done) => {
			const container = new Container();
			container.addChild(new DynamicBorder((str: string) => theme.fg("accent", str)));
			container.addChild(new Text(theme.fg("accent", theme.bold("Optional: add a custom instruction for this review"))));

			const input = new Input();
			input.onSubmit = (value) => done({ cancelled: false, instruction: value.trim() || undefined });
			input.onEscape = () => done({ cancelled: true });
			container.addChild(input);

			container.addChild(new Text(theme.fg("dim", "Enter empty to skip • enter with text to apply • esc to cancel")));
			container.addChild(new DynamicBorder((str: string) => theme.fg("accent", str)));

			return {
				get focused() {
					return input.focused;
				},
				set focused(value: boolean) {
					input.focused = value;
				},
				render(width: number) {
					return container.render(width);
				},
				invalidate() {
					container.invalidate();
				},
				handleInput(data: string) {
					input.handleInput(data);
					tui.requestRender();
				},
			};
		}, { blocked: { kind: "question", message: "Add or skip a review instruction" } });
	}

	function appendExtraReviewInstruction(prompt: string, extraInstruction: string | undefined): string {
		const trimmed = extraInstruction?.trim();
		if (!trimmed) return prompt;

		return `${prompt}\n\nAdditional user-provided review instruction:\n\n${trimmed}`;
	}

	pi.on("session_start", (_event, ctx) => {
		applyReviewState(ctx);
	});

	pi.on("session_tree", (_event, ctx) => {
		applyReviewState(ctx);
	});

	/**
	 * Determine the smart default review type based on git state
	 */
	async function getSmartDefault(): Promise<"baseBranch" | "uncommitted"> {
		// Default to base branch review (most common workflow)
		return "baseBranch";
	}

	/**
	 * Show the review preset selector
	 */
	async function showReviewSelector(ctx: ExtensionContext): Promise<ReviewTarget | null> {
		// Determine smart default
		const smartDefault = await getSmartDefault();
		const items: SelectItem[] = REVIEW_PRESETS.map((preset) => ({
			value: preset.value,
			label: preset.label,
			description: preset.description,
		}));
		const smartDefaultIndex = items.findIndex((item) => item.value === smartDefault);

		if (ctx.mode !== "tui") {
			const label = await ctx.ui.select("Select a review preset", items.map((item) => item.label));
			const value = items.find((item) => item.label === label)?.value;
			if (value === "uncommitted") return { type: "uncommitted" };
			if (value === "baseBranch") return showBranchSelector(ctx);
			return null;
		}

		const result = await ctx.ui.custom<ReviewPresetValue | null>((tui, theme, _kb, done) => {
			const container = new Container();
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
			container.addChild(new Text(theme.fg("accent", theme.bold("Select a review preset"))));

			const selectList = new SelectList(items, Math.min(items.length, 10), {
				selectedPrefix: (text) => theme.fg("accent", text),
				selectedText: (text) => theme.fg("accent", text),
				description: (text) => theme.fg("muted", text),
				scrollInfo: (text) => theme.fg("dim", text),
				noMatch: (text) => theme.fg("warning", text),
			});

			// Preselect the smart default without reordering the list
			if (smartDefaultIndex >= 0) {
				selectList.setSelectedIndex(smartDefaultIndex);
			}

			selectList.onSelect = (item) => done(item.value as ReviewPresetValue);
			selectList.onCancel = () => done(null);

			container.addChild(selectList);
			container.addChild(new Text(theme.fg("dim", "Press enter to confirm or esc to go back")));
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

			return {
				render(width: number) {
					return container.render(width);
				},
				invalidate() {
					container.invalidate();
				},
				handleInput(data: string) {
					selectList.handleInput(data);
					tui.requestRender();
				},
			};
		}, { blocked: { kind: "question", message: "Select a review preset" } });

		if (!result) return null;

		switch (result) {
			case "uncommitted":
				return { type: "uncommitted" };

			case "baseBranch": {
				const target = await showBranchSelector(ctx);
				return target;
			}

			default:
				return null;
		}
	}

	/**
	 * Show branch selector for base branch review
	 */
	async function showBranchSelector(ctx: ExtensionContext): Promise<ReviewTarget | null> {
		const branches = await getLocalBranches(pi);
		const currentBranch = await getCurrentBranch(pi);
		const defaultBranch = await getDefaultBranch(pi);

		// Never offer the current branch as a base branch (reviewing against itself is meaningless).
		const candidateBranches = currentBranch ? branches.filter((b) => b !== currentBranch) : branches;

		if (candidateBranches.length === 0) {
			ctx.ui.notify(
				currentBranch ? `No other branches found (current branch: ${currentBranch})` : "No branches found",
				"error",
			);
			return null;
		}

		// Sort branches with default branch first
		const sortedBranches = candidateBranches.sort((a, b) => {
			if (a === defaultBranch) return -1;
			if (b === defaultBranch) return 1;
			return a.localeCompare(b);
		});

		if (ctx.mode !== "tui") {
			const branch = await ctx.ui.select("Select base branch", sortedBranches);
			return branch ? { type: "baseBranch", branch } : null;
		}

		const items: SelectItem[] = sortedBranches.map((branch) => ({
			value: branch,
			label: branch,
			description: branch === defaultBranch ? "(default)" : "",
		}));

		const result = await ctx.ui.custom<string | null>((tui, theme, keybindings, done) => {
			const container = new Container();
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
			container.addChild(new Text(theme.fg("accent", theme.bold("Select base branch"))));

			const searchInput = new Input();
			container.addChild(searchInput);
			container.addChild(new Spacer(1));

			const listContainer = new Container();
			container.addChild(listContainer);
			container.addChild(new Text(theme.fg("dim", "Type to filter • enter to select • esc to cancel")));
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

			let filteredItems = items;
			let selectList: SelectList | null = null;

			const updateList = () => {
				listContainer.clear();
				if (filteredItems.length === 0) {
					listContainer.addChild(new Text(theme.fg("warning", "  No matching branches")));
					selectList = null;
					return;
				}

				selectList = new SelectList(filteredItems, Math.min(filteredItems.length, 10), {
					selectedPrefix: (text) => theme.fg("accent", text),
					selectedText: (text) => theme.fg("accent", text),
					description: (text) => theme.fg("muted", text),
					scrollInfo: (text) => theme.fg("dim", text),
					noMatch: (text) => theme.fg("warning", text),
				});

				selectList.onSelect = (item) => done(item.value);
				selectList.onCancel = () => done(null);
				listContainer.addChild(selectList);
			};

			const applyFilter = () => {
				const query = searchInput.getValue();
				filteredItems = query
					? fuzzyFilter(items, query, (item) => `${item.label} ${item.value} ${item.description ?? ""}`)
					: items;
				updateList();
			};

			applyFilter();

			return {
				render(width: number) {
					return container.render(width);
				},
				invalidate() {
					container.invalidate();
				},
				handleInput(data: string) {
					if (
						keybindings.matches(data, "tui.select.up") ||
						keybindings.matches(data, "tui.select.down") ||
						keybindings.matches(data, "tui.select.confirm") ||
						keybindings.matches(data, "tui.select.cancel")
					) {
						if (selectList) {
							selectList.handleInput(data);
						} else if (keybindings.matches(data, "tui.select.cancel")) {
							done(null);
						}
						tui.requestRender();
						return;
					}

					searchInput.handleInput(data);
					applyFilter();
					tui.requestRender();
				},
			};
		}, { blocked: { kind: "question", message: "Select a review base branch" } });

		if (!result) return null;
		return { type: "baseBranch", branch: result };
	}

	/**
	 * Execute the review
	 */
	async function executeReview(
		ctx: ExtensionCommandContext,
		target: ReviewTarget,
		useFreshSession: boolean,
		options?: { extraInstruction?: string },
	): Promise<boolean> {
		// Check if we're already in a review
		if (reviewOriginId) {
			ctx.ui.notify("Already in a review. Use /review-end to finish first.", "warning");
			return false;
		}

		const focusPrompt = await buildReviewPrompt(pi, target);
		const hint = getUserFacingHint(target);
		const sessionName = buildReviewSessionName(target);

		// Load the review skill (stable content, goes first for cache efficiency).
		const skillResult = await loadSkill("pac-review");
		if (!skillResult) {
			ctx.ui.notify("Could not load skills/pac-review/SKILL.md", "error");
			return false;
		}
		const skillContent = skillResult.content;

		if (useFreshSession) {
			// Store current position (where we'll return to).
			// In an empty session there is no leaf yet, so create a lightweight anchor first.
			let originId = ctx.sessionManager.getLeafId() ?? undefined;
			if (!originId) {
				pi.appendEntry(REVIEW_ANCHOR_TYPE, { createdAt: new Date().toISOString() });
				originId = ctx.sessionManager.getLeafId() ?? undefined;
			}
			if (!originId) {
				ctx.ui.notify("Failed to determine review origin.", "error");
				return false;
			}
			reviewOriginId = originId;

			// Keep a local copy so session_tree events during navigation don't wipe it
			const lockedOriginId = originId;

			// Find the first user message in the session.
			// If none exists (e.g. brand-new session), we'll stay on the current leaf.
			const entries = ctx.sessionManager.getEntries();
			const firstUserMessage = entries.find(
				(e) => e.type === "message" && e.message.role === "user",
			);

			if (firstUserMessage) {
				// Navigate to the first user message to start a new session from that point
				// Label it as "code-review" so it's visible in the tree
				try {
					const result = await ctx.navigateTree(firstUserMessage.id, { summarize: false, label: "code-review" });
					if (result.cancelled) {
						reviewOriginId = undefined;
						return false;
					}
				} catch (error) {
					// Clean up state if navigation fails
					reviewOriginId = undefined;
					ctx.ui.notify(`Failed to start review: ${error instanceof Error ? error.message : String(error)}`, "error");
					return false;
				}

				// Clear the editor (navigating to user message fills it with the message text)
				ctx.ui.setEditorText("");
			}

			// Restore origin after navigation events (session_tree can reset it)
			reviewOriginId = lockedOriginId;

			// Show widget indicating review is active
			setReviewWidget(ctx, true);

			// Persist review state so tree navigation can restore/reset it
			pi.appendEntry(REVIEW_STATE_TYPE, { active: true, originId: lockedOriginId, targetType: target.type });
		}
		const projectGuidelines = ctx.isProjectTrusted()
			? await loadProjectReviewGuidelines(ctx.cwd)
			: null;

		// Build the prompt: stable content first, dynamic content last.
		let fullPrompt = `${skillContent}\n\n---\n\nPlease perform a code review with the following focus:\n\n${focusPrompt}`;

		fullPrompt = appendExtraReviewInstruction(fullPrompt, options?.extraInstruction);

		if (projectGuidelines) {
			fullPrompt += `\n\nThis project has additional instructions for code reviews:\n\n${projectGuidelines}`;
		}

		const modeHint = useFreshSession ? " (fresh session)" : "";
		ctx.ui.notify(`Starting review: ${hint}${modeHint}`, "info");
		if (sessionName) {
			pi.setSessionName(sessionName);
		}

		// Send as a user message that triggers a turn
		pi.sendUserMessage(fullPrompt);
		return true;
	}

	// Register the /review-start command
	pi.registerCommand("review-start", {
		description: "Review code changes (uncommitted or against a base branch)",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Review requires interactive mode", "error");
				return;
			}

			// Check if we're already in a review
			if (reviewOriginId) {
				ctx.ui.notify("Already in a review. Use /review-end to finish first.", "warning");
				return;
			}

			// Check if we're in a git repository
			const { code } = await pi.exec("git", ["rev-parse", "--git-dir"]);
			if (code !== 0) {
				ctx.ui.notify("Not a git repository", "error");
				return;
			}

			// Try to parse direct arguments
			let target: ReviewTarget | null = null;
			let fromSelector = false;
			let extraInstruction: string | undefined;
			const parsed = parseArgs(args);
			if (parsed.error) {
				ctx.ui.notify(parsed.error, "error");
				return;
			}
			extraInstruction = parsed.extraInstruction?.trim() || undefined;

			if (parsed.target) {
				target = parsed.target;
			}

			// If no args or invalid args, show selector
			if (!target) {
				fromSelector = true;
				target = await showReviewSelector(ctx);
			}

			if (!target) {
				ctx.ui.notify("Review cancelled", "info");
				return;
			}

			// Determine if we should use fresh session mode
			const entries = ctx.sessionManager.getEntries();
			const messageCount = entries.filter((e) => e.type === "message").length;

			// In an empty session, default to fresh review mode so /review-end works consistently.
			let useFreshSession = messageCount === 0;

			if (messageCount > 0) {
				// Existing session - ask user which mode they want
				const choice = await ctx.ui.select("Start review in:", ["New session", "Current session"]);

				if (choice === undefined) {
					ctx.ui.notify("Review cancelled", "info");
					return;
				}

				useFreshSession = choice === "New session";
			}

			if (fromSelector && !extraInstruction) {
				const promptResult = await promptForOptionalReviewInstruction(ctx);
				if (promptResult.cancelled) {
					ctx.ui.notify("Review cancelled", "info");
					return;
				}
				extraInstruction = promptResult.instruction;
			}

			await executeReview(ctx, target, useFreshSession, { extraInstruction });
		},
	});

	type EndReviewAction = "returnOnly" | "returnAndFix" | "returnAndSummarize";
	type EndReviewActionResult = "ok" | "cancelled" | "error";
	type EndReviewActionOptions = {
		showSummaryLoader?: boolean;
		notifySuccess?: boolean;
		extraInstruction?: string;
	};

	function getActiveReviewOrigin(ctx: ExtensionContext): string | undefined {
		if (reviewOriginId) {
			return reviewOriginId;
		}

		const state = getReviewState(ctx);
		if (state?.active && state.originId) {
			reviewOriginId = state.originId;
			return reviewOriginId;
		}

		if (state?.active) {
			setReviewWidget(ctx, false);
			pi.appendEntry(REVIEW_STATE_TYPE, { active: false });
			ctx.ui.notify("Review state was missing origin info; cleared review status.", "warning");
		}

		return undefined;
	}

	function clearReviewState(ctx: ExtensionContext) {
		setReviewWidget(ctx, false);
		reviewOriginId = undefined;
		pi.appendEntry(REVIEW_STATE_TYPE, { active: false });
	}

	async function navigateWithSummary(
		ctx: ExtensionCommandContext,
		originId: string,
		showLoader: boolean,
		extraInstruction?: string,
	): Promise<{ cancelled: boolean; error?: string } | null> {
		const basePrompt = await loadReviewSummaryPrompt();
		const summaryPrompt = appendExtraReviewInstruction(basePrompt, extraInstruction);

		if (showLoader && ctx.mode === "tui") {
			return ctx.ui.custom<{ cancelled: boolean; error?: string } | null>((tui, theme, _kb, done) => {
				const loader = new BorderedLoader(tui, theme, "Returning and summarizing review session...");
				loader.onAbort = () => done(null);

				ctx.navigateTree(originId, {
					summarize: true,
					customInstructions: summaryPrompt,
					replaceInstructions: true,
				})
					.then(done)
					.catch((err) => done({ cancelled: false, error: err instanceof Error ? err.message : String(err) }));

				return loader;
			});
		}

		try {
			return await ctx.navigateTree(originId, {
				summarize: true,
				customInstructions: summaryPrompt,
				replaceInstructions: true,
			});
		} catch (error) {
			return { cancelled: false, error: error instanceof Error ? error.message : String(error) };
		}
	}

	async function executeEndReviewAction(
		ctx: ExtensionCommandContext,
		action: EndReviewAction,
		options: EndReviewActionOptions = {},
	): Promise<EndReviewActionResult> {
		const originId = getActiveReviewOrigin(ctx);
		if (!originId) {
			if (!getReviewState(ctx)?.active) {
				ctx.ui.notify("Not in a review session (use /review-start first, or review was started in current session mode)", "info");
			}
			return "error";
		}

		const notifySuccess = options.notifySuccess ?? true;
		const reviewTargetType = getReviewState(ctx)?.targetType;

		if (action === "returnOnly") {
			try {
				const result = await ctx.navigateTree(originId, { summarize: false });
				if (result.cancelled) {
					ctx.ui.notify("Navigation cancelled. Use /review-end to try again.", "info");
					return "cancelled";
				}
			} catch (error) {
				ctx.ui.notify(`Failed to return: ${error instanceof Error ? error.message : String(error)}`, "error");
				return "error";
			}

			clearReviewState(ctx);
			if (notifySuccess) {
				ctx.ui.notify("Review complete! Returned to original position.", "info");
			}
			return "ok";
		}

		let summaryResult: { cancelled: boolean; error?: string } | null;
		try {
			summaryResult = await navigateWithSummary(
				ctx,
				originId,
				options.showSummaryLoader ?? false,
				options.extraInstruction,
			);
		} catch (error) {
			ctx.ui.notify(formatReviewPromptError(error), "error");
			return "error";
		}
		if (summaryResult === null) {
			ctx.ui.notify("Summarization cancelled. Use /review-end to try again.", "info");
			return "cancelled";
		}

		if (summaryResult.error) {
			ctx.ui.notify(`Summarization failed: ${summaryResult.error}`, "error");
			return "error";
		}

		if (summaryResult.cancelled) {
			ctx.ui.notify("Navigation cancelled. Use /review-end to try again.", "info");
			return "cancelled";
		}

		clearReviewState(ctx);

		if (action === "returnAndSummarize") {
			if (!ctx.ui.getEditorText().trim()) {
				ctx.ui.setEditorText("Act on the review findings");
			}
			if (notifySuccess) {
				ctx.ui.notify("Review complete! Returned and summarized.", "info");
			}
			return "ok";
		}

		let fixPrompt: string;
		try {
			const fixFindingsTemplate = await loadReviewFixFindingsPrompt();
			fixPrompt = appendExtraReviewInstruction(
				buildReviewFixFindingsPrompt(fixFindingsTemplate, reviewTargetType),
				options.extraInstruction,
			);
		} catch (error) {
			ctx.ui.notify(formatReviewPromptError(error), "error");
			return "error";
		}
		pi.sendUserMessage(fixPrompt, { deliverAs: "followUp" });
		if (notifySuccess) {
			ctx.ui.notify("Review complete! Returned and queued a follow-up to fix findings.", "info");
		}
		return "ok";
	}

	async function runEndReview(ctx: ExtensionCommandContext): Promise<void> {
		if (!ctx.hasUI) {
			ctx.ui.notify("/review-end requires interactive mode", "error");
			return;
		}

		if (endReviewInProgress) {
			ctx.ui.notify("/review-end is already running", "info");
			return;
		}

		endReviewInProgress = true;
		try {
			const endReviewOptions: Array<{ label: string; action: EndReviewAction }> = [
				{ label: "Summarize + return + fix findings", action: "returnAndFix" },
				{ label: "Summarize + return", action: "returnAndSummarize" },
				{ label: "Return only", action: "returnOnly" },
			];
			const choice = await ctx.ui.select(
				"Finish review:",
				endReviewOptions.map((option) => option.label),
			);

			if (choice === undefined) {
				ctx.ui.notify("Cancelled. Use /review-end to try again.", "info");
				return;
			}

			const action = endReviewOptions.find((option) => option.label === choice)?.action;
			if (!action) {
				ctx.ui.notify("Unknown review action selected. Use /review-end to try again.", "error");
				return;
			}

			let extraInstruction: string | undefined;
			if (action !== "returnOnly") {
				const promptResult = await promptForOptionalReviewInstruction(ctx);
				if (promptResult.cancelled) {
					ctx.ui.notify("Cancelled. Use /review-end to try again.", "info");
					return;
				}
				extraInstruction = promptResult.instruction;
			}

			await executeEndReviewAction(ctx, action, {
				showSummaryLoader: true,
				notifySuccess: true,
				extraInstruction,
			});
		} finally {
			endReviewInProgress = false;
		}
	}

	// Register the /review-end command
	pi.registerCommand("review-end", {
		description: "Complete review and return to original position",
		handler: async (_args, ctx) => {
			await runEndReview(ctx);
		},
	});
}
