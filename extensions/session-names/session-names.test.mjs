import test from "node:test";
import assert from "node:assert/strict";
import sessionNamesExtension from "./index.ts";
import {
	buildWorkflowSessionName,
	extractSlashCommandArgument,
	normalizeSessionNameSuffix,
} from "./helpers.ts";

test("normalizeSessionNameSuffix collapses whitespace and strips wrapping quotes", () => {
	assert.equal(normalizeSessionNameSuffix('  "fix   README   install steps"  '), "fix README install steps");
});

test("normalizeSessionNameSuffix shortens GitHub issue and PR URLs", () => {
	assert.equal(
		normalizeSessionNameSuffix("https://github.com/ladislas/mypac/issues/126"),
		"issue #126",
	);
	assert.equal(
		normalizeSessionNameSuffix("https://github.com/ladislas/mypac/pull/456/files"),
		"PR #456",
	);
});

test("workflow session names prefer leading GitHub targets over multiline context", () => {
	const lwotInput = extractSlashCommandArgument(
		`/pac-lwot "\nhttps://github.com/ladislas/mypac/issues/368\nadditional context here\n"`,
		"pac-lwot",
	);
	assert.notEqual(lwotInput, null);
	assert.equal(buildWorkflowSessionName("lwot", lwotInput), "lwot - issue #368");

	const llatInput = extractSlashCommandArgument(
		`/pac-llat "\nhttps://github.com/ladislas/mypac/pull/404\nadditional context here\n"`,
		"pac-llat",
	);
	assert.notEqual(llatInput, null);
	assert.equal(buildWorkflowSessionName("llat", llatInput), "llat - PR #404");
});

for (const workflow of ["lwot", "llat"]) {
	test(`${workflow} input event names a quoted repository handoff after its task`, async () => {
		const handlers = new Map();
		const names = [];
		sessionNamesExtension({
			on: (event, handler) => handlers.set(event, handler),
			setSessionName: (name) => names.push(name),
		});
		const result = await handlers.get("input")({
			type: "input",
			source: "interactive",
			text: `/pac-${workflow} "\nhttps://github.com/ladislas/mypac\n\nPrepare the next mypac release from the latest main.\n\nFollow AGENTS.md and release v2.0.0 constraints.\n"`,
		});
		assert.deepEqual(names, [`${workflow} - Prepare the next mypac release from the latest main.`]);
		assert.deepEqual(result, { action: "continue" });
	});

	test(`${workflow} input event preserves repository fallbacks and existing naming`, async () => {
		const handlers = new Map();
		const names = [];
		sessionNamesExtension({
			on: (event, handler) => handlers.set(event, handler),
			setSessionName: (name) => names.push(name),
		});
		const cases = [
			["https://github.com/ladislas/mypac", "github.com/ladislas/mypac"],
			['"\nhttps://github.com/ladislas/mypac/\n\n---\n##\n```\n"', "github.com/ladislas/mypac"],
			["'\r\nhttps://github.com/ladislas/mypac\r\n\r\n---\r\nFix   the install steps.\r\nIgnore later text.\r\n'", "Fix the install steps."],
			['"\nhttps://github.com/ladislas/mypac/issues/368\nadditional context here\n"', "issue #368"],
			['"\nhttps://github.com/ladislas/mypac/pull/404\nadditional context here\n"', "PR #404"],
			["https://example.com/spec-notes/?view=full", "example.com/spec-notes"],
			['"fix   README\ninstall steps"', "fix README install steps"],
			[`"\nhttps://github.com/ladislas/mypac\n\n${"a".repeat(70)}\nLater instructions\n"`, `${"a".repeat(57)}...`],
		];
		for (const [argument, suffix] of cases) {
			await handlers.get("input")({ type: "input", source: "interactive", text: `/pac-${workflow} ${argument}` });
			assert.equal(names.at(-1), `${workflow} - ${suffix}`, argument);
		}
		for (const event of [
			{ source: "extension", text: `/pac-${workflow} do not rename` },
			{ source: "interactive", text: `/pac-${workflow}-other do not rename` },
		]) {
			await handlers.get("input")({ type: "input", ...event });
		}
		assert.equal(names.length, cases.length);
	});
}

test("normalizeSessionNameSuffix trims generic URLs", () => {
	assert.equal(normalizeSessionNameSuffix("https://example.com/spec-notes/?view=full"), "example.com/spec-notes");
});

test("normalizeSessionNameSuffix truncates long input", () => {
	assert.equal(normalizeSessionNameSuffix("a".repeat(70), 12), "aaaaaaaaa...");
});

test("buildWorkflowSessionName returns undefined without usable input", () => {
	assert.equal(buildWorkflowSessionName("lwot", "   "), undefined);
	assert.equal(buildWorkflowSessionName("   ", "target"), undefined);
});

test("buildWorkflowSessionName prefixes normalized input", () => {
	assert.equal(buildWorkflowSessionName("lwot", "  fix README install steps  "), "lwot - fix README install steps");
	assert.equal(buildWorkflowSessionName("llat", "  issue #295  "), "llat - issue #295");
});

test("extractSlashCommandArgument finds pac-lwot input", () => {
	assert.equal(extractSlashCommandArgument("/pac-lwot fix the README", "pac-lwot"), "fix the README");
	assert.equal(
		extractSlashCommandArgument("/pac-lwot   https://github.com/ladislas/mypac/issues/126  ", "pac-lwot"),
		"https://github.com/ladislas/mypac/issues/126",
	);
	assert.equal(extractSlashCommandArgument("/pac-lwot", "pac-lwot"), "");
	assert.equal(extractSlashCommandArgument("/ghi fix README", "pac-lwot"), null);
});
