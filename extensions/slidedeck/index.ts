import { mkdir, writeFile } from "node:fs/promises";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { withFileMutationQueue } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import {
	buildSlidedeckPrompt,
	getSlidedeckFileUrl,
	getSlidedeckMarkdownLink,
	getSlidedeckLocation,
	renderSlidedeckHtml,
	resolveAgentDir,
} from "./helpers.ts";

type SlidedeckFlowState = {
	active: true;
};

export default function slidedeckExtension(pi: ExtensionAPI): void {
	let activeFlow: SlidedeckFlowState | undefined;

	pi.registerTool({
		name: "save_slidedeck",
		label: "Save Slidedeck",
		description: "Save a self-contained HTML slidedeck under the Pi agent directory.",
		promptSnippet: "Save a self-contained HTML slidedeck outside the repo workspace",
		promptGuidelines: [
			"Use save_slidedeck when the user asks for a presentation-style HTML artifact or slidedeck.",
			"Use save_slidedeck instead of write or edit for deck output files, because deck files must stay out of the repo workspace.",
		],
		parameters: Type.Object({
			title: Type.String({ description: "Deck title" }),
			slides: Type.Array(
				Type.Object({
					title: Type.String({ description: "Slide title" }),
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
								`<file name=\"${location.file}\">`,
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

			activeFlow = { active: true };
			pi.sendUserMessage(buildSlidedeckPrompt(args ?? ""));
		},
	});

	pi.on("tool_call", async (event) => {
		if (!activeFlow) {
			return;
		}

		if (event.toolName === "write" || event.toolName === "edit") {
			return {
				block: true,
				reason: "Workspace deck files are blocked in /pac-slidedeck. Use save_slidedeck instead.",
			};
		}
	});

	pi.on("agent_end", async (_event, _ctx) => {
		activeFlow = undefined;
	});

	pi.on("session_shutdown", async (_event, _ctx) => {
		activeFlow = undefined;
	});
}
