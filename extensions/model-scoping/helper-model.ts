import { completeSimple, type Model } from "@mariozechner/pi-ai";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { ThinkingLevelSetting } from "./settings.ts";

export async function runHelperModelPrompt(
	ctx: ExtensionContext,
	options: {
		model: Model<any>;
		thinkingLevel: ThinkingLevelSetting;
		systemPrompt?: string;
		prompt: string;
	},
): Promise<string> {
	const auth = await ctx.modelRegistry.getApiKeyAndHeaders(options.model);
	if (!auth.ok) {
		throw new Error(auth.error);
	}

	const response = await completeSimple(
		options.model,
		{
			systemPrompt: options.systemPrompt,
			messages: [
				{
					role: "user",
					content: options.prompt,
					timestamp: Date.now(),
				},
			],
		},
		{
			apiKey: auth.apiKey,
			headers: auth.headers,
			signal: ctx.signal,
			reasoning: options.thinkingLevel === "off" ? undefined : options.thinkingLevel,
		},
	);

	const text = response.content
		.filter((part): part is { type: "text"; text: string } => part.type === "text")
		.map((part) => part.text)
		.join("\n")
		.trim();
	if (!text) {
		throw new Error("Helper model returned no text output");
	}
	return text;
}
