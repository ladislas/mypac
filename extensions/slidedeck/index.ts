import { mkdir, writeFile } from "node:fs/promises";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { withFileMutationQueue } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import {
	buildSlidedeckPrompt,
	getSlidedeckFileUrl,
	getSlidedeckMarkdownLink,
	getSlidedeckLocation,
	getSessionSlidedeckDir,
	isSessionSlidedeckFile,
	renderSlidedeckHtml,
	resolveAgentDir,
} from "./helpers.ts";

export default function slidedeckExtension(pi: ExtensionAPI): void {
	let activeFlow = false;
	let lastDeckPath: string | undefined;

	const persistLastDeckPath = (filePath: string) => {
		lastDeckPath = filePath;
		pi.appendEntry("slidedeck-state", { lastDeckPath: filePath });
	};

	const reconstructState = (ctx: ExtensionContext) => {
		lastDeckPath = undefined;
		activeFlow = false;

		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === "slidedeck-state") {
				const savedPath = entry.data && typeof entry.data === "object" ? (entry.data as { lastDeckPath?: unknown }).lastDeckPath : undefined;
				if (typeof savedPath === "string") {
					lastDeckPath = savedPath;
				}
				continue;
			}

			if (entry.type !== "message") {
				continue;
			}

			const message = entry.message;
			if (message.role !== "toolResult" || message.toolName !== "save_slidedeck") {
				continue;
			}

			const savedPath = message.details && typeof message.details === "object" ? (message.details as { path?: unknown }).path : undefined;
			if (typeof savedPath === "string") {
				lastDeckPath = savedPath;
			}
		}
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
			"When refining an existing slidedeck, prefer reading the latest saved deck, copying it to a new `-vN` HTML file, and making focused edits to the copy instead of regenerating the whole deck.",
			"Preserve untouched slides verbatim during slidedeck iterations, and use in-place edits only for tiny fixes such as typos.",
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
				persistLastDeckPath(location.file);
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
			pi.sendUserMessage(buildSlidedeckPrompt(args ?? "", { sessionDeckDir, lastDeckPath }));
		},
	});

	pi.on("tool_call", async (event, ctx) => {
		if (!activeFlow) {
			return;
		}

		if (event.toolName === "write" || event.toolName === "edit") {
			const sessionDeckDir = getSessionSlidedeckDir(resolveAgentDir(), ctx.sessionManager.getSessionId());
			const targetPath = typeof event.input.path === "string" ? event.input.path : undefined;

			if (targetPath && isSessionSlidedeckFile(targetPath, sessionDeckDir)) {
				return;
			}

			return {
				block: true,
				reason: `Workspace deck files are blocked in /pac-slidedeck. Use save_slidedeck or refine an HTML deck under ${sessionDeckDir}.`,
			};
		}
	});

	pi.on("tool_result", async (event, ctx) => {
		if (event.isError) {
			return;
		}

		if (event.toolName !== "write" && event.toolName !== "edit") {
			return;
		}

		const targetPath = typeof event.input.path === "string" ? event.input.path : undefined;
		const sessionDeckDir = getSessionSlidedeckDir(resolveAgentDir(), ctx.sessionManager.getSessionId());
		if (!targetPath || !isSessionSlidedeckFile(targetPath, sessionDeckDir)) {
			return;
		}

		persistLastDeckPath(targetPath);
	});

	pi.on("agent_end", async (_event, _ctx) => {
		activeFlow = false;
	});

	pi.on("session_shutdown", async (_event, _ctx) => {
		activeFlow = false;
	});
}
