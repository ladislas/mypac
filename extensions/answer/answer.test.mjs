import test from "node:test";
import assert from "node:assert/strict";
import { ModelRegistry, ModelRuntime } from "@earendil-works/pi-coding-agent";
import answerExtension from "./index.ts";
import {
	createCredentials,
	createModelServer,
	fakeOpenAiCodexCredential,
	HANG_RESPONSE,
} from "../../scripts/test-support/model-routing.mjs";
import {
	normalizeQuestions,
	parseExtractionResult,
	extractQuestions,
	formatExtractionFailure,
	selectExtractionModel,
} from "./extraction.ts";

test("/answer does not open custom TUI in RPC mode", async () => {
	let handler;
	const notifications = [];
	answerExtension({
		registerCommand(name, definition) {
			if (name === "answer") handler = definition.handler;
		},
		registerShortcut() {},
	});

	await handler("", {
		mode: "rpc",
		hasUI: true,
		ui: {
			custom: async () => { throw new Error("custom TUI must not run in RPC mode"); },
			notify: (message, level) => notifications.push({ message, level }),
		},
	});

	assert.deepEqual(notifications, [{ message: "answer requires interactive TUI mode", level: "error" }]);
});

// --- selectExtractionModel ---

const currentModel = { provider: "openai", id: "gpt-5.4" };
const miniModel = { provider: "openai-codex", id: "gpt-5.6-luna" };
const haikuModel = { provider: "anthropic", id: "claude-haiku-4-5" };

function modelRegistryWith(models) {
	return {
		find(provider, id) {
			return models.find((model) => model.provider === provider && model.id === id);
		},
		getAvailable() {
			return models;
		},
		async getApiKeyAndHeaders() {
			return { ok: true };
		},
	};
}

test("selectExtractionModel prefers the highest-priority available model", async () => {
	const selected = await selectExtractionModel(
		currentModel,
		modelRegistryWith([haikuModel, miniModel]),
		[],
	);
	assert.equal(selected, miniModel);
});

test("selectExtractionModel restricts candidates to scoped models", async () => {
	const selected = await selectExtractionModel(
		currentModel,
		modelRegistryWith([miniModel, haikuModel]),
		[{ model: haikuModel }],
	);
	assert.equal(selected, haikuModel);
});

test("selectExtractionModel falls back to current model when candidates are outside scope", async () => {
	const selected = await selectExtractionModel(
		currentModel,
		modelRegistryWith([miniModel, haikuModel]),
		[{ model: currentModel }],
	);
	assert.equal(selected, currentModel);
});

test("selectExtractionModel falls back to current model when preferred models are missing", async () => {
	const selected = await selectExtractionModel(currentModel, modelRegistryWith([]), []);
	assert.equal(selected, currentModel);
});

// --- extractQuestions ---

test("extractQuestions completes through the model registry and forwards cancellation", async () => {
	const signal = new AbortController().signal;
	let request;
	const result = await extractQuestions(
		{
			async complete(model, context, options) {
				request = { model, context, options };
				return {
					stopReason: "stop",
					content: [{ type: "text", text: '{"questions":[{"question":"Choose?"}]}' }],
				};
			},
		},
		miniModel,
		"Assistant text",
		signal,
	);

	assert.deepEqual(result, { questions: [{ question: "Choose?" }] });
	assert.equal(request.model, miniModel);
	assert.equal(request.context.messages[0].content[0].text, "Assistant text");
	assert.equal(request.options.signal, signal);
});

test("extractQuestions returns null when completion is aborted", async () => {
	const result = await extractQuestions(
		{
			async complete() {
				return { stopReason: "aborted", content: [] };
			},
		},
		miniModel,
		"Assistant text",
		new AbortController().signal,
	);
	assert.equal(result, null);
});

test("extractQuestions uses built-in API-key auth and Headroom-style provider overrides", async (t) => {
	const server = await createModelServer(t, ['{"questions":[{"question":"API key?"}]}']);
	const credentials = await createCredentials({
		openai: { type: "api_key", key: "test-api-key" },
	});
	const runtime = await ModelRuntime.create({ credentials, allowModelNetwork: false });
	runtime.registerProvider("openai", {
		baseUrl: `${server.baseUrl}/v1`,
		headers: { "x-headroom-route": "active" },
	});
	const model = runtime.getModel("openai", "gpt-5.4-mini");
	assert.ok(model);

	const result = await extractQuestions(
		new ModelRegistry(runtime),
		model,
		"Do you use the active route?",
		new AbortController().signal,
	);

	assert.deepEqual(result, { questions: [{ question: "API key?" }] });
	assert.equal(server.requests[0].url, "/v1/responses");
	assert.equal(server.requests[0].headers.authorization, "Bearer test-api-key");
	assert.equal(server.requests[0].headers["x-headroom-route"], "active");
});

test("extractQuestions uses built-in OAuth auth and active provider overrides", async (t) => {
	const server = await createModelServer(t, ['{"questions":[{"question":"OAuth?"}]}']);
	const credential = fakeOpenAiCodexCredential();
	const credentials = await createCredentials({ "openai-codex": credential });
	const runtime = await ModelRuntime.create({ credentials, allowModelNetwork: false });
	runtime.registerProvider("openai-codex", {
		baseUrl: `${server.baseUrl}/backend-api`,
		headers: { "x-active-runtime": "yes" },
	});
	const model = runtime.getModel("openai-codex", "gpt-5.6-luna");
	assert.ok(model);

	const originalWebSocket = globalThis.WebSocket;
	globalThis.WebSocket = undefined;
	let result;
	try {
		result = await extractQuestions(
			new ModelRegistry(runtime),
			model,
			"Does OAuth survive?",
			new AbortController().signal,
		);
	} finally {
		globalThis.WebSocket = originalWebSocket;
	}

	assert.deepEqual(result, { questions: [{ question: "OAuth?" }] });
	assert.equal(server.requests[0].url, "/backend-api/codex/responses");
	assert.equal(server.requests[0].headers.authorization, `Bearer ${credential.access}`);
	assert.equal(server.requests[0].headers["chatgpt-account-id"], "test-account");
	assert.equal(server.requests[0].headers["x-active-runtime"], "yes");
});

test("extractQuestions honors extension custom-provider registration and removal", async (t) => {
	const server = await createModelServer(t, ['{"questions":[{"question":"Custom?"}]}']);
	const runtime = await ModelRuntime.create({ allowModelNetwork: false });
	runtime.registerProvider("answer-provider", {
		name: "Answer Provider",
		baseUrl: `${server.baseUrl}/v1`,
		apiKey: "answer-provider-key",
		api: "openai-responses",
		models: [{
			id: "answer-model",
			name: "Answer Model",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128_000,
			maxTokens: 4_096,
		}],
	});
	const registry = new ModelRegistry(runtime);
	const model = registry.find("answer-provider", "answer-model");
	assert.ok(model);

	const result = await extractQuestions(
		registry,
		model,
		"Does the custom provider work?",
		new AbortController().signal,
	);

	assert.deepEqual(result, { questions: [{ question: "Custom?" }] });
	assert.equal(server.requests[0].headers.authorization, "Bearer answer-provider-key");
	runtime.unregisterProvider("answer-provider");
	assert.equal(registry.find("answer-provider", "answer-model"), undefined);
});

test("extractQuestions forwards cancellation through the active runtime", async (t) => {
	const server = await createModelServer(t, [HANG_RESPONSE]);
	const credentials = await createCredentials({
		openai: { type: "api_key", key: "test-api-key" },
	});
	const runtime = await ModelRuntime.create({ credentials, allowModelNetwork: false });
	runtime.registerProvider("openai", { baseUrl: `${server.baseUrl}/v1` });
	const model = runtime.getModel("openai", "gpt-5.4-mini");
	assert.ok(model);
	const controller = new AbortController();

	const extraction = extractQuestions(new ModelRegistry(runtime), model, "Wait", controller.signal);
	await server.requestReceived;
	controller.abort();

	assert.equal(await extraction, null);
	assert.equal(server.requests.length, 1);
});

// --- normalizeQuestions ---

test("normalizeQuestions accepts wrapped object with questions array", () => {
	const result = normalizeQuestions({ questions: [{ question: "What is your name?" }] });
	assert.deepEqual(result, { questions: [{ question: "What is your name?" }] });
});

test("normalizeQuestions accepts bare array of question objects", () => {
	const result = normalizeQuestions([{ question: "Where are you?" }]);
	assert.deepEqual(result, { questions: [{ question: "Where are you?" }] });
});

test("normalizeQuestions accepts bare array of strings", () => {
	const result = normalizeQuestions(["Why?", "How?"]);
	assert.deepEqual(result, { questions: [{ question: "Why?" }, { question: "How?" }] });
});

test("normalizeQuestions includes context when present", () => {
	const result = normalizeQuestions({
		questions: [{ question: "Which DB?", context: "Only MySQL or PostgreSQL are supported." }],
	});
	assert.deepEqual(result, {
		questions: [{ question: "Which DB?", context: "Only MySQL or PostgreSQL are supported." }],
	});
});

test("normalizeQuestions omits empty context", () => {
	const result = normalizeQuestions({ questions: [{ question: "Why?", context: "" }] });
	assert.deepEqual(result, { questions: [{ question: "Why?" }] });
});

test("normalizeQuestions filters out items with empty question", () => {
	const result = normalizeQuestions({ questions: [{ question: "" }, { question: "Valid?" }] });
	assert.deepEqual(result, { questions: [{ question: "Valid?" }] });
});

test("normalizeQuestions returns empty questions array for empty input array", () => {
	const result = normalizeQuestions({ questions: [] });
	assert.deepEqual(result, { questions: [] });
});

test("normalizeQuestions returns null for non-object/non-array input", () => {
	assert.equal(normalizeQuestions(null), null);
	assert.equal(normalizeQuestions(undefined), null);
	assert.equal(normalizeQuestions("string"), null);
	assert.equal(normalizeQuestions(42), null);
});

// --- parseExtractionResult ---

test("parseExtractionResult parses clean JSON object", () => {
	const json = JSON.stringify({ questions: [{ question: "What?" }] });
	const result = parseExtractionResult(json);
	assert.deepEqual(result, { questions: [{ question: "What?" }] });
});

test("parseExtractionResult parses JSON wrapped in markdown fences", () => {
	const text = '```json\n{"questions":[{"question":"Why?"}]}\n```';
	const result = parseExtractionResult(text);
	assert.deepEqual(result, { questions: [{ question: "Why?" }] });
});

test("parseExtractionResult parses JSON embedded in surrounding text", () => {
	const text = 'Here are the questions: {"questions":[{"question":"How?"}]} Hope that helps.';
	const result = parseExtractionResult(text);
	assert.deepEqual(result, { questions: [{ question: "How?" }] });
});

test("parseExtractionResult returns null for plain non-JSON text", () => {
	const result = parseExtractionResult("This is just some text with no JSON.");
	assert.equal(result, null);
});

test("parseExtractionResult returns null for empty string", () => {
	assert.equal(parseExtractionResult(""), null);
});

// --- formatExtractionFailure ---

test("formatExtractionFailure includes model output preview", () => {
	const msg = formatExtractionFailure("not valid json");
	assert.ok(msg.includes("Question extraction returned invalid JSON"));
	assert.ok(msg.includes("not valid json"));
});

test("formatExtractionFailure truncates long output", () => {
	const long = "x".repeat(500);
	const msg = formatExtractionFailure(long);
	assert.ok(msg.length < 300);
	assert.ok(msg.includes("..."));
});

test("formatExtractionFailure handles empty string", () => {
	const msg = formatExtractionFailure("   ");
	assert.equal(msg, "Question extraction returned invalid JSON.");
});
