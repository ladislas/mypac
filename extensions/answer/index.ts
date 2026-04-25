/**
 * Q&A extraction hook - extracts questions from assistant responses
 * Original source: https://github.com/mitsuhiko/agent-stuff/blob/main/extensions/answer.ts
 *
 * Custom interactive TUI for answering questions.
 *
 * Demonstrates the "prompt generator" pattern with custom TUI:
 * 1. /answer command gets the last assistant message
 * 2. Shows a spinner while extracting questions as structured JSON
 * 3. Presents an interactive TUI to navigate and answer questions
 * 4. Submits the compiled answers when done
 */

import { complete, type UserMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { BorderedLoader } from "@mariozechner/pi-coding-agent";
import {
	formatExtractionFailure,
	parseExtractionResult,
	selectExtractionModel,
	SYSTEM_PROMPT,
	type ExtractionFailure,
	type ExtractionResult,
} from "./extraction.ts";
import { QnAComponent } from "./qna-component.ts";

const answerHandler = async (pi: ExtensionAPI, ctx: ExtensionContext) => {
	if (!ctx.hasUI) {
		ctx.ui.notify("answer requires interactive mode", "error");
		return;
	}

	if (!ctx.model) {
		ctx.ui.notify("No model selected", "error");
		return;
	}

	// Find the last assistant message on the current branch
	const branch = ctx.sessionManager.getBranch();
	let lastAssistantText: string | undefined;

	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i];
		if (entry.type === "message") {
			const msg = entry.message;
			if ("role" in msg && msg.role === "assistant") {
				if (msg.stopReason !== "stop") {
					ctx.ui.notify(`Last assistant message incomplete (${msg.stopReason})`, "error");
					return;
				}
				const textParts = msg.content
					.filter((c): c is { type: "text"; text: string } => c.type === "text")
					.map((c) => c.text);
				if (textParts.length > 0) {
					lastAssistantText = textParts.join("\n");
					break;
				}
			}
		}
	}

	if (!lastAssistantText) {
		ctx.ui.notify("No assistant messages found", "error");
		return;
	}

	// Select the best model for extraction (prefer GPT-5.4 mini, then haiku)
	const extractionModel = await selectExtractionModel(ctx.model, ctx.modelRegistry);

	// Run extraction with loader UI
	const extractionResult = await ctx.ui.custom<ExtractionResult | ExtractionFailure | null>((tui, theme, _kb, done) => {
		const loader = new BorderedLoader(tui, theme, `Extracting questions using ${extractionModel.id}...`);
		loader.onAbort = () => done(null);

		const doExtract = async () => {
			const auth = await ctx.modelRegistry.getApiKeyAndHeaders(extractionModel);
			if (!auth.ok) {
				throw new Error(auth.error);
			}
			const userMessage: UserMessage = {
				role: "user",
				content: [{ type: "text", text: lastAssistantText! }],
				timestamp: Date.now(),
			};

			const response = await complete(
				extractionModel,
				{ systemPrompt: SYSTEM_PROMPT, messages: [userMessage] },
				{ apiKey: auth.apiKey, headers: auth.headers, signal: loader.signal },
			);

			if (response.stopReason === "aborted") {
				return null;
			}

			const responseText = response.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("\n");

			return parseExtractionResult(responseText) ?? { error: formatExtractionFailure(responseText) };
		};

		doExtract()
			.then(done)
			.catch((error) =>
				done({ error: error instanceof Error ? error.message : String(error) }),
			);

		return loader;
	});

	if (extractionResult === null) {
		ctx.ui.notify("Cancelled", "info");
		return;
	}

	if ("error" in extractionResult) {
		ctx.ui.notify(extractionResult.error, "error");
		return;
	}

	if (extractionResult.questions.length === 0) {
		ctx.ui.notify("No questions found in the last message", "info");
		return;
	}

	// Show the Q&A component
	const answersResult = await ctx.ui.custom<string | null>((tui, _theme, _kb, done) => {
		return new QnAComponent(extractionResult.questions, tui, done);
	});

	if (answersResult === null) {
		ctx.ui.notify("Cancelled", "info");
		return;
	}

	// Send the answers directly as a message and trigger a turn
	pi.sendMessage(
		{
			customType: "answers",
			content: "I answered your questions in the following way:\n\n" + answersResult,
			display: true,
		},
		{ triggerTurn: true },
	);
};

export default function (pi: ExtensionAPI) {
	pi.registerCommand("answer", {
		description: "Extract questions from last assistant message into interactive Q&A",
		handler: (_args, ctx) => answerHandler(pi, ctx),
	});

	pi.registerShortcut("ctrl+.", {
		description: "Extract and answer questions",
		handler: (ctx) => answerHandler(pi, ctx),
	});
}
