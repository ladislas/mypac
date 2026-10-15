import test from "node:test";
import assert from "node:assert/strict";
import sharedAppendSystemExtension from "./index.ts";
import {
	VERBOSITY_STEERING_PROMPT,
	appendVerbositySteeringPrompt,
	formatSharedAppendSystemPrompt,
	insertSharedAppendSystemPrompt,
	sharedAppendSystemPath,
} from "./prompt.ts";

const sharedBlock = formatSharedAppendSystemPrompt("# Shared\n\n## Rules");

test("formatSharedAppendSystemPrompt wraps shared instructions with XML boundaries", () => {
	assert.match(sharedBlock, /^<shared_append_system_context>\n/);
	assert.match(sharedBlock, /Shared package append-system instructions and guidelines:/);
	assert.ok(sharedBlock.includes(`<shared_append_system_instructions path="${sharedAppendSystemPath}">\n# Shared\n\n## Rules`));
	assert.match(sharedBlock, /\n<\/shared_append_system_context>$/);
});

test("formatSharedAppendSystemPrompt omits empty shared instructions", () => {
	assert.equal(formatSharedAppendSystemPrompt(""), "");
});

test("insertSharedAppendSystemPrompt inserts before real append-system prompt", () => {
	const append = "Real APPEND_SYSTEM.md text";
	const prompt = ["Pi base", append, "<project_context>", "Project instructions", "</project_context>"].join("\n\n");
	const result = insertSharedAppendSystemPrompt(prompt, sharedBlock, append);

	assert.ok(result.indexOf("Pi base") < result.indexOf("<shared_append_system_context>"));
	assert.ok(result.indexOf("<shared_append_system_context>") < result.indexOf(append));
	assert.ok(result.indexOf(append) < result.indexOf("<project_context>"));
});

test("insertSharedAppendSystemPrompt inserts before project context when no append prompt exists", () => {
	const prompt = ["Pi base", "<project_context>", "Project instructions", "</project_context>"].join("\n\n");
	const result = insertSharedAppendSystemPrompt(prompt, sharedBlock);

	assert.ok(result.indexOf("Pi base") < result.indexOf("<shared_append_system_context>"));
	assert.ok(result.indexOf("<shared_append_system_context>") < result.indexOf("<project_context>"));
});

test("insertSharedAppendSystemPrompt falls through to project context when append prompt is absent from system prompt", () => {
	const prompt = ["Pi base", "<project_context>", "Project instructions", "</project_context>"].join("\n\n");
	const result = insertSharedAppendSystemPrompt(prompt, sharedBlock, "missing append text");

	assert.ok(result.indexOf("<shared_append_system_context>") < result.indexOf("<project_context>"));
});

test("insertSharedAppendSystemPrompt inserts before current date when there is no context marker", () => {
	const prompt = "Pi base\nCurrent date: 2026-05-20\nCurrent working directory: /repo";
	const result = insertSharedAppendSystemPrompt(prompt, sharedBlock);

	assert.ok(result.indexOf("Pi base") < result.indexOf("<shared_append_system_context>"));
	assert.ok(result.indexOf("<shared_append_system_context>") < result.indexOf("Current date:"));
	assert.match(result, /<\/shared_append_system_context>\n\nCurrent date:/);
});

test("insertSharedAppendSystemPrompt is idempotent", () => {
	const prompt = `Pi base\n\n${sharedBlock}\n\n<project_context>`;
	assert.equal(insertSharedAppendSystemPrompt(prompt, sharedBlock), prompt);
});

test("appendVerbositySteeringPrompt appends terse guidance at the end without changing the prefix", () => {
	const prompt = "Pi base\n\n<project_context>\nProject instructions\n</project_context>";
	const result = appendVerbositySteeringPrompt(prompt);

	assert.ok(result.startsWith(`${prompt}\n\n`));
	assert.ok(result.endsWith(VERBOSITY_STEERING_PROMPT));
	assert.match(VERBOSITY_STEERING_PROMPT, /terse/i);
	assert.match(VERBOSITY_STEERING_PROMPT, /avoid restating/i);
});

test("appendVerbositySteeringPrompt inserts terse guidance before the dynamic footer", () => {
	const footer = "Current date: 2026-05-20\nCurrent working directory: /repo";
	const prompt = `Pi base\n\n<project_context>\nProject instructions\n</project_context>\n${footer}`;
	const result = appendVerbositySteeringPrompt(prompt);

	assert.ok(result.includes(`</project_context>\n\n${VERBOSITY_STEERING_PROMPT}\n${footer}`));
	assert.ok(result.endsWith(footer));
});

test("appendVerbositySteeringPrompt inserts terse guidance before a current working directory footer", () => {
	const footer = "Current working directory: /repo";
	const prompt = `Pi base\n\n<project_context>\nProject instructions\n</project_context>\n${footer}`;
	const result = appendVerbositySteeringPrompt(prompt);

	assert.ok(result.includes(`</project_context>\n\n${VERBOSITY_STEERING_PROMPT}\n${footer}`));
	assert.ok(result.endsWith(footer));
});

test("appendVerbositySteeringPrompt is idempotent", () => {
	const prompt = `Pi base\n\n${VERBOSITY_STEERING_PROMPT}\nCurrent date: 2026-05-20`;
	assert.equal(appendVerbositySteeringPrompt(prompt), prompt);
});

test("shared append-system extension inserts shared instructions before append-system prompt", async () => {
	const handlers = new Map();
	const pi = {
		on(event, handler) {
			handlers.set(event, handler);
		},
	};
	sharedAppendSystemExtension(pi);

	assert.equal(typeof handlers.get("session_start"), "function");
	assert.equal(typeof handlers.get("before_agent_start"), "function");
	await handlers.get("session_start")();

	const append = "Real APPEND_SYSTEM.md text";
	const event = {
		systemPrompt: `Pi base\n\n${append}\n\n<project_context>\nProject instructions\n</project_context>`,
		systemPromptOptions: { appendSystemPrompt: append },
	};
	const result = await handlers.get("before_agent_start")(event);

	assert.ok(result.systemPrompt.includes(`<shared_append_system_instructions path="${sharedAppendSystemPath}">`));
	assert.ok(result.systemPrompt.indexOf("<shared_append_system_context>") < result.systemPrompt.indexOf(append));
	assert.match(result.systemPrompt, /repository execution hygiene/i);
	assert.match(result.systemPrompt, /before the first implementation mutation/i);
	assert.match(result.systemPrompt, /actual default branch/i);
	assert.match(result.systemPrompt, /whether Pi creates commits.*separate.*commit quality/is);
	assert.match(result.systemPrompt, /when Pi creates commits.*coherent.*proportionate verification/is);
	assert.match(result.systemPrompt, /unrelated.*explicit.*scoped staging/is);
	assert.match(result.systemPrompt, /explicit authorization.*push.*merge.*force-push.*history rewrite/is);
	assert.match(result.systemPrompt, /repository policy may strengthen.*not weaken/is);
	assert.match(result.systemPrompt, /do not supply a screenshot path/i);
	assert.match(result.systemPrompt, /explicitly requests a specific output path/i);
	assert.ok(result.systemPrompt.endsWith(VERBOSITY_STEERING_PROMPT));
});

test("shared instructions survive custom-message runs without a user prompt", async () => {
	const handlers = new Map();
	sharedAppendSystemExtension({
		on(event, handler) { handlers.set(event, handler); },
	});
	await handlers.get("session_start")();

	const event = {
		messageType: "custom",
		message: { customType: "fixture", content: "Continue", display: false },
		systemPrompt: "Pi base",
		systemPromptOptions: {},
	};
	const result = await handlers.get("before_agent_start")(event);
	assert.match(result.systemPrompt, /<shared_append_system_context>/);
	assert.ok(result.systemPrompt.endsWith(VERBOSITY_STEERING_PROMPT));
	const repeated = await handlers.get("before_agent_start")({ ...event, systemPrompt: result.systemPrompt });
	assert.equal(repeated.systemPrompt, result.systemPrompt);
});

test("shared append-system extension tolerates missing system prompt options", async () => {
	const handlers = new Map();
	sharedAppendSystemExtension({
		on(event, handler) {
			handlers.set(event, handler);
		},
	});
	await handlers.get("session_start")();

	const result = await handlers.get("before_agent_start")({
		systemPrompt: "Pi base\n\n<project_context>\nProject instructions\n</project_context>",
	});

	assert.ok(result.systemPrompt.indexOf("<shared_append_system_context>") < result.systemPrompt.indexOf("<project_context>"));
	assert.ok(result.systemPrompt.endsWith(VERBOSITY_STEERING_PROMPT));
});
