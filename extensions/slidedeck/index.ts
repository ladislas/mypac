import path from "node:path";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
	getNextSlidedeckRevisionPath,
	getSlidedeckFileUrl,
	getSingleRefinementEditTargetPath,
	getSlidedeckMarkdownLink,
	getSlidedeckLocation,
	getSlidedeckStateFromEntries,
	getSessionSlidedeckDir,
	isPiManagedSlidedeckFile,
	isSessionSlidedeckFile,
	parseStrictSlidedeckCopyCommand,
	renderSlidedeckHtml,
	resolveAgentDir,
} from "./helpers.ts";
import { buildPiSlidedeckPrompt } from "./skill-guidance.ts";

export default function slidedeckExtension(pi: ExtensionAPI): void {
	let activeFlow = false;
	let currentDeckPath: string | undefined;
	let pendingDeckPath: string | undefined;

	const persistState = (nextState: { currentDeckPath?: string; pendingDeckPath?: string }) => {
		currentDeckPath = nextState.currentDeckPath;
		pendingDeckPath = nextState.pendingDeckPath;
		pi.appendEntry("slidedeck-state", nextState);
	};

	const reconstructState = (ctx: ExtensionContext) => {
		activeFlow = false;
		const restoredState = getSlidedeckStateFromEntries(ctx.sessionManager.getBranch());
		currentDeckPath = restoredState.currentDeckPath;
		pendingDeckPath = restoredState.pendingDeckPath;
	};

	const isCurrentPendingDeck = (filePath: string): boolean => {
		return Boolean(pendingDeckPath && path.resolve(filePath) === path.resolve(pendingDeckPath));
	};

	const getExpectedRefinementTarget = async (sourcePath: string, sessionDeckDir: string): Promise<string> => {
		const existingFiles = await readdir(sessionDeckDir).catch((error: NodeJS.ErrnoException) => {
			if (error.code === "ENOENT") {
				return [];
			}

			throw error;
		});

		return getNextSlidedeckRevisionPath(sourcePath, sessionDeckDir, existingFiles);
	};

	pi.on("session_start", async (_event, ctx) => reconstructState(ctx));
	pi.on("session_tree", async (_event, ctx) => reconstructState(ctx));

	pi.registerTool({
		name: "save_slidedeck",
		label: "Save Slidedeck",
		description: "Save a self-contained HTML slidedeck under the Pi agent directory.",
		promptSnippet: "Save a self-contained HTML slidedeck outside the repo workspace",
		promptGuidelines: [
			"Use save_slidedeck when the user asks for a presentation-style HTML artifact or slidedeck.",
			"Use save_slidedeck instead of write or edit for deck output files, because deck files must stay out of the repo workspace.",
			"Each slide accepts an optional eyebrow field for a category label (e.g. 'Problem', 'Solution'); omit it to default to 'Slide N'.",
		],
		parameters: Type.Object({
			title: Type.String({ description: "Deck title" }),
			slides: Type.Array(
				Type.Object({
					title: Type.String({ description: "Slide title" }),
					eyebrow: Type.Optional(
						Type.String({
							description:
								"Optional eyebrow label shown above the slide title (e.g. 'Problem', 'Solution'). Defaults to 'Slide N' when omitted.",
						}),
					),
					body: Type.String({
						description: "HTML fragment for the slide body. Do not include <html>, <head>, or <body>.",
					}),
				}),
				{ minItems: 1, description: "Slides to include in the deck" },
			),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const agentDir = resolveAgentDir();
			const location = getSlidedeckLocation({
				agentDir,
				sessionId: ctx.sessionManager.getSessionId(),
				title: params.title,
			});
			const html = renderSlidedeckHtml({
				title: params.title,
				slides: params.slides,
				generatedAt: new Date(),
			});

			return withFileMutationQueue(location.file, async () => {
				await mkdir(location.dir, { recursive: true });
				await writeFile(location.file, html, "utf8");
				persistState({ currentDeckPath: location.file, pendingDeckPath: undefined });
				const fileUrl = getSlidedeckFileUrl(location.file);
				const markdownLink = getSlidedeckMarkdownLink(location.file);
				return {
					content: [
						{
							type: "text",
							text: [
								"Saved HTML slidedeck.",
								`Path: ${location.file}`,
								`Link: ${markdownLink}`,
								`URL: ${fileUrl}`,
							].join("\n"),
						},
					],
					details: {
						path: location.file,
						fileUrl,
						markdownLink,
						title: params.title,
						slideCount: params.slides.length,
					},
				};
			});
		},
	});

	pi.registerCommand("pac-slidedeck", {
		description: "Create a self-contained HTML slidedeck under ~/.pi/agent/slidedecks",
		handler: async (args, ctx) => {
			if (!ctx.isIdle()) {
				ctx.ui.notify("/pac-slidedeck can only run while the agent is idle", "warning");
				return;
			}

			const agentDir = resolveAgentDir();
			const sessionDeckDir = getSessionSlidedeckDir(agentDir, ctx.sessionManager.getSessionId());
			activeFlow = true;
			pi.sendUserMessage(buildPiSlidedeckPrompt(args ?? "", { sessionDeckDir, currentDeckPath, pendingDeckPath }));
		},
	});

	pi.on("tool_call", async (event, ctx) => {
		if (!activeFlow) {
			return;
		}

		const agentDir = resolveAgentDir();
		const sessionDeckDir = getSessionSlidedeckDir(agentDir, ctx.sessionManager.getSessionId());

		if (event.toolName === "write") {
			return {
				block: true,
				reason: `Write is blocked in /pac-slidedeck. Use save_slidedeck for new decks, or refine only the pending copied deck under ${sessionDeckDir}.`,
			};
		}

		if (event.toolName === "edit") {
			const targetPath = getSingleRefinementEditTargetPath(event.input);

			if (targetPath && pendingDeckPath && isCurrentPendingDeck(targetPath) && isSessionSlidedeckFile(targetPath, sessionDeckDir)) {
				return;
			}

			return {
				block: true,
				reason: pendingDeckPath
					? `Deck refinement edits must target only the pending copied deck: ${pendingDeckPath}`
					: `Deck refinement requires a validated copy first. Use exactly one bash command in the form cp <source.html> <target-vN.html> under ${sessionDeckDir}.`,
			};
		}

		if (event.toolName === "bash") {
			const command = typeof event.input.command === "string" ? event.input.command : "";
			const copyCommand = parseStrictSlidedeckCopyCommand(command);

			if (copyCommand) {
				if (pendingDeckPath) {
					return {
						block: true,
						reason: `A pending copied deck is already tracked. Resume by editing ${pendingDeckPath} instead of copying again.`,
					};
				}

				if (!isPiManagedSlidedeckFile(copyCommand.sourcePath, agentDir)) {
					return {
						block: true,
						reason: `Deck refinement sources must be Pi-managed HTML decks under ${path.join(agentDir, "slidedecks")}.`,
					};
				}

				const expectedTargetPath = await getExpectedRefinementTarget(copyCommand.sourcePath, sessionDeckDir);
				if (!isSessionSlidedeckFile(copyCommand.targetPath, sessionDeckDir) || path.resolve(copyCommand.targetPath) !== path.resolve(expectedTargetPath)) {
					return {
						block: true,
						reason: `Deck refinement copies must target the exact next fresh revision: ${expectedTargetPath}`,
					};
				}

				return;
			}

			if (isMutatingShellCommand(command)) {
				return {
					block: true,
					reason: "Shell mutation is blocked in /pac-slidedeck except for the validated single-file cp refinement copy.",
				};
			}
		}
	});

	pi.on("tool_result", async (event, ctx) => {
		if (event.isError) {
			return;
		}

		if (event.toolName === "bash") {
			const command = typeof event.input.command === "string" ? event.input.command : "";
			const copyCommand = parseStrictSlidedeckCopyCommand(command);
			if (copyCommand) {
				persistState({ currentDeckPath: copyCommand.sourcePath, pendingDeckPath: copyCommand.targetPath });
			}
			return;
		}

		if (event.toolName !== "edit") {
			return;
		}

		const targetPath = getSingleRefinementEditTargetPath(event.input);
		const sessionDeckDir = getSessionSlidedeckDir(resolveAgentDir(), ctx.sessionManager.getSessionId());
		if (!targetPath || !pendingDeckPath || !isCurrentPendingDeck(targetPath) || !isSessionSlidedeckFile(targetPath, sessionDeckDir)) {
			return;
		}

		persistState({ currentDeckPath: targetPath, pendingDeckPath: undefined });
	});

	pi.on("agent_end", async (_event, _ctx) => {
		activeFlow = false;
	});

	pi.on("session_shutdown", async (_event, _ctx) => {
		activeFlow = false;
	});
}

function isMutatingShellCommand(command: string): boolean {
	const trimmed = command.trim();
	if (!trimmed) {
		return false;
	}

	return (
		/(^|[;&|()]\s*)(cp|mv|rm|touch|mkdir|rmdir|install|ln|tee)\b/.test(trimmed) ||
		/(^|\s)(sed|perl)\s+-i\b/.test(trimmed) ||
		/(^|\s)>>?(?!&)/.test(trimmed)
	);
}
