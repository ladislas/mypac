import test from "node:test";
import assert from "node:assert/strict";
import personasExtension from "./index.ts";

for (const messageType of ["user", "custom"]) {
	test(`active persona applies to ${messageType}-initiated runs`, async () => {
		const handlers = new Map();
		personasExtension({
			on(event, handler) { handlers.set(event, handler); },
			registerCommand() {},
		});
		const ctx = {
			ui: { setStatus() {}, theme: { fg: (_color, text) => text } },
			sessionManager: {
				getBranch: () => [{ type: "custom", customType: "persona-state", data: { activePersona: "rick" } }],
			},
		};
		await handlers.get("session_start")({}, ctx);

		const event = {
			messageType,
			...(messageType === "user"
				? { prompt: "Hello" }
				: { message: { customType: "fixture", content: "Continue", display: false } }),
			systemPrompt: "Pi base",
			systemPromptOptions: {},
		};
		const result = await handlers.get("before_agent_start")(event, ctx);
		assert.match(result.systemPrompt, /rick/i);
		assert.ok(result.systemPrompt.startsWith("Pi base"));
		const repeated = await handlers.get("before_agent_start")({ ...event, systemPrompt: result.systemPrompt }, ctx);
		assert.equal(repeated.systemPrompt, result.systemPrompt);
	});
}
