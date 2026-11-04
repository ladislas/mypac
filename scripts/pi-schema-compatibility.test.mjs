import assert from "node:assert/strict";
import test from "node:test";
import { validateToolArguments } from "@earendil-works/pi-ai";
import slidedeckExtension from "../extensions/slidedeck/index.ts";
import uvExtension from "../extensions/uv/index.ts";

// Exercise the schemas actually registered by mypac against the pinned validator.
function registeredTool(extension) {
	let tool;
	extension({
		registerTool(definition) { tool = definition; },
		registerCommand() {},
		on() {},
	});
	assert.ok(tool);
	return tool;
}

function validate(tool, args, extra = {}) {
	return validateToolArguments(tool, {
		type: "toolCall", id: "compatibility", name: tool.name, arguments: args, ...extra,
	});
}

const deck = registeredTool(slidedeckExtension);
const slide = { title: "Slide", body: "<p>Content</p>" };

test("pinned validator accepts the existing TypeBox slidedeck schema and optional eyebrow", () => {
	for (const slides of [[slide], [{ ...slide, eyebrow: "Context" }]]) {
		const args = { title: "Deck", slides };
		assert.deepEqual(validate(deck, args), args);
	}
});

test("pinned validator rejects missing fields and empty slidedecks", () => {
	for (const args of [{}, { title: "Deck" }, { title: "Deck", slides: [] },
		{ title: "Deck", slides: [{ title: "Missing body" }] }]) {
		assert.throws(() => validate(deck, args), /Validation failed/);
	}
});

test("pinned validator coerces scalar strings and singleton slides without mutating the transcript", () => {
	const args = { title: 42, slides: { title: 7, body: 9 } };
	assert.deepEqual(validate(deck, args), {
		title: "42", slides: [{ title: "7", body: "9" }],
	});
	assert.deepEqual(args, { title: 42, slides: { title: 7, body: 9 } });
});

test("pinned validator rejects malformed JSON arguments before tool execution", () => {
	assert.throws(() => validate(deck, {}, { argumentsError: "Unexpected end of JSON input" }),
		/Invalid arguments for tool "save_slidedeck"/);
});

test("wrapped bash retains its schema and executes validated arguments", async () => {
	const bash = registeredTool(uvExtension);
	const args = validate(bash, { command: "printf pi-compatibility", timeout: "5" });
	assert.equal(args.timeout, 5);
	const result = await bash.execute("compatibility", args);
	assert.ok(result.content.some(({ type, text }) => type === "text" && text.includes("pi-compatibility")));
	assert.throws(() => validate(bash, {}), /Validation failed/);
});

test("representative MCP/codemode JSON schemas retain nested refs, enums, and numeric coercion", () => {
	const tool = {
		name: "mcp__fixture__lookup", description: "Schema boundary fixture",
		parameters: {
			type: "object", required: ["query"],
			properties: { query: { $ref: "#/$defs/query" } },
			$defs: { query: {
				type: "object", required: ["limit", "kind"],
				properties: { limit: { type: "integer", minimum: 1 }, kind: { enum: ["read", "list"] } },
			} },
		},
	};
	assert.deepEqual(validate(tool, { query: { limit: "2", kind: "read" } }),
		{ query: { limit: 2, kind: "read" } });
	for (const query of [{ limit: 0, kind: "read" }, { limit: 2, kind: "write" }, {}]) {
		assert.throws(() => validate(tool, { query }), /Validation failed/);
	}
});
