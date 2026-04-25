import type { Model, Api } from "@mariozechner/pi-ai";
import type { ModelRegistry } from "@mariozechner/pi-coding-agent";

// Structured output format for question extraction
export interface ExtractedQuestion {
	question: string;
	context?: string;
}

export interface ExtractionResult {
	questions: ExtractedQuestion[];
}

export interface ExtractionFailure {
	error: string;
}

export const SYSTEM_PROMPT = `You are a question extractor. Given text from a conversation, extract any questions that need answering.

Output a JSON object with this structure:
{
  "questions": [
    {
      "question": "The question text",
      "context": "Optional context that helps answer the question"
    }
  ]
}

Rules:
- Extract all questions that require user input
- Keep questions in the order they appeared
- Be concise with question text
- Include context only when it provides essential information for answering
- Return valid JSON only
- Do not wrap the JSON in markdown fences
- Do not add any explanation before or after the JSON
- If no questions are found, return {"questions": []}

Example output:
{
  "questions": [
    {
      "question": "What is your preferred database?",
      "context": "We can only configure MySQL and PostgreSQL because of what is implemented."
    },
    {
      "question": "Should we use TypeScript or JavaScript?"
    }
  ]
}`;

const EXTRACTION_MODEL_CANDIDATES = [
	{ provider: "openai-codex", id: "gpt-5.4-mini" },
	{ provider: "anthropic", id: "claude-haiku-4-5-20251001" },
	{ provider: "anthropic", id: "claude-haiku-4-5" },
] as const;

/**
 * Prefer GPT-5.4 mini for extraction when available, otherwise fallback to haiku or the current model.
 */
export async function selectExtractionModel(
	currentModel: Model<Api>,
	modelRegistry: ModelRegistry,
): Promise<Model<Api>> {
	for (const candidate of EXTRACTION_MODEL_CANDIDATES) {
		const model = modelRegistry.find(candidate.provider, candidate.id);
		if (!model) {
			continue;
		}

		const auth = await modelRegistry.getApiKeyAndHeaders(model);
		if (auth.ok) {
			return model;
		}
	}

	return currentModel;
}

/**
 * Normalize raw parsed JSON into a validated ExtractionResult, or return null on failure.
 */
export function normalizeQuestions(value: unknown): ExtractionResult | null {
	const rawQuestions = Array.isArray(value)
		? value
		: value && typeof value === "object" && Array.isArray((value as { questions?: unknown }).questions)
			? (value as { questions: unknown[] }).questions
			: null;

	if (!rawQuestions) {
		return null;
	}

	const questions = rawQuestions
		.filter((item): item is { question?: unknown; context?: unknown } | string => {
			return typeof item === "string" || (!!item && typeof item === "object");
		})
		.map((item) => {
			if (typeof item === "string") {
				return { question: item.trim() };
			}

			const question = typeof item.question === "string" ? item.question.trim() : "";
			const context = typeof item.context === "string" ? item.context.trim() : "";

			return {
				question,
				...(context ? { context } : {}),
			};
		})
		.filter((item) => item.question.length > 0);

	return { questions };
}

/**
 * Parse the JSON response from the extraction LLM.
 * Tries several candidate sub-strings in order of preference.
 */
export function parseExtractionResult(text: string): ExtractionResult | null {
	const candidates: string[] = [];
	const trimmed = text.trim();
	if (trimmed) {
		candidates.push(trimmed);
	}

	const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/u);
	if (jsonMatch?.[1]) {
		candidates.push(jsonMatch[1].trim());
	}

	const firstBrace = text.indexOf("{");
	const lastBrace = text.lastIndexOf("}");
	if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
		candidates.push(text.slice(firstBrace, lastBrace + 1).trim());
	}

	const firstBracket = text.indexOf("[");
	const lastBracket = text.lastIndexOf("]");
	if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
		candidates.push(text.slice(firstBracket, lastBracket + 1).trim());
	}

	for (const candidate of candidates) {
		try {
			const parsed = JSON.parse(candidate) as unknown;
			const normalized = normalizeQuestions(parsed);
			if (normalized) {
				return normalized;
			}
		} catch {
			// Try the next candidate.
		}
	}

	return null;
}

export function formatExtractionFailure(rawText: string): string {
	const compact = rawText.replace(/\s+/gu, " ").trim();
	const preview = compact.length > 220 ? `${compact.slice(0, 217)}...` : compact;
	return preview
		? `Question extraction returned invalid JSON. Model output: ${preview}`
		: "Question extraction returned invalid JSON.";
}
