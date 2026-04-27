import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	getLatestSessionStateEntryIds,
	readScopedModelDefaults,
	resolveEffectiveModelDefaults,
	restoreScopedModelDefaults,
	writeScopedModelDefaults,
} from "./settings.ts";

function makeWorkspace() {
	const root = mkdtempSync(path.join(tmpdir(), "model-scoping-"));
	const projectDir = path.join(root, "project");
	const agentDir = path.join(root, "agent");
	mkdirSync(projectDir, { recursive: true });
	mkdirSync(agentDir, { recursive: true });
	return { root, projectDir, agentDir };
}

function readJson(filePath) {
	return JSON.parse(readFileSync(filePath, "utf8"));
}

test("writeScopedModelDefaults preserves unrelated settings while updating managed defaults", async () => {
	const workspace = makeWorkspace();
	const repoSettingsPath = path.join(workspace.projectDir, ".pi", "settings.json");
	mkdirSync(path.dirname(repoSettingsPath), { recursive: true });
	writeFileSync(
		repoSettingsPath,
		JSON.stringify(
			{
				theme: "nightowl",
				compaction: { enabled: true, reserveTokens: 8192 },
				defaultProvider: "openai",
				defaultModel: "gpt-4o-mini",
				defaultThinkingLevel: "low",
			},
			null,
			2,
		),
	);

	await writeScopedModelDefaults(
		workspace.projectDir,
		"repo",
		{
			defaultProvider: "anthropic",
			defaultModel: "claude-sonnet-4-5",
			defaultThinkingLevel: "high",
		},
		workspace.agentDir,
	);

	assert.deepEqual(readJson(repoSettingsPath), {
		theme: "nightowl",
		compaction: { enabled: true, reserveTokens: 8192 },
		defaultProvider: "anthropic",
		defaultModel: "claude-sonnet-4-5",
		defaultThinkingLevel: "high",
	});

	await writeScopedModelDefaults(workspace.projectDir, "repo", {}, workspace.agentDir);

	assert.deepEqual(readJson(repoSettingsPath), {
		theme: "nightowl",
		compaction: { enabled: true, reserveTokens: 8192 },
	});
});

test("resolveEffectiveModelDefaults ignores partial repo model overrides while keeping repo thinking overrides", () => {
	assert.deepEqual(
		resolveEffectiveModelDefaults({
			repo: { defaultProvider: "anthropic", defaultThinkingLevel: "high" },
			global: { defaultProvider: "openai", defaultModel: "gpt-4o", defaultThinkingLevel: "low" },
		}),
		{
			defaultProvider: "openai",
			defaultModel: "gpt-4o",
			defaultThinkingLevel: "high",
		},
	);

	assert.deepEqual(
		resolveEffectiveModelDefaults({
			repo: { defaultModel: "claude-sonnet-4-5" },
			global: { defaultProvider: "anthropic", defaultModel: "claude-opus-4-1" },
		}),
		{
			defaultProvider: "anthropic",
			defaultModel: "claude-opus-4-1",
			defaultThinkingLevel: undefined,
		},
	);
});

test("restoreScopedModelDefaults restores saved defaults without clobbering unrelated settings", async () => {
	const workspace = makeWorkspace();
	const globalSettingsPath = path.join(workspace.agentDir, "settings.json");
	const repoSettingsPath = path.join(workspace.projectDir, ".pi", "settings.json");
	mkdirSync(path.dirname(repoSettingsPath), { recursive: true });
	writeFileSync(
		globalSettingsPath,
		JSON.stringify(
			{
				theme: "nightowl",
				defaultProvider: "openai",
				defaultModel: "gpt-4o",
				defaultThinkingLevel: "medium",
			},
			null,
			2,
		),
	);
	writeFileSync(
		repoSettingsPath,
		JSON.stringify(
			{
				defaultThinkingLevel: "high",
				packages: ["pi-skills"],
			},
			null,
			2,
		),
	);

	const savedDefaults = await readScopedModelDefaults(workspace.projectDir, workspace.agentDir);

	writeFileSync(
		globalSettingsPath,
		JSON.stringify(
			{
				theme: "light",
				defaultProvider: "anthropic",
				defaultModel: "claude-sonnet-4-5",
				defaultThinkingLevel: "low",
			},
			null,
			2,
		),
	);
	writeFileSync(
		repoSettingsPath,
		JSON.stringify(
			{
				defaultProvider: "anthropic",
				defaultModel: "claude-opus-4-1",
				defaultThinkingLevel: "off",
				packages: ["pi-skills"],
			},
			null,
			2,
		),
	);

	await restoreScopedModelDefaults(workspace.projectDir, savedDefaults, workspace.agentDir);

	assert.deepEqual(readJson(globalSettingsPath), {
		theme: "light",
		defaultProvider: "openai",
		defaultModel: "gpt-4o",
		defaultThinkingLevel: "medium",
	});
	assert.deepEqual(readJson(repoSettingsPath), {
		defaultThinkingLevel: "high",
		packages: ["pi-skills"],
	});
});

test("restoreScopedModelDefaults removes settings files when only managed defaults were present originally", async () => {
	const workspace = makeWorkspace();
	const globalSettingsPath = path.join(workspace.agentDir, "settings.json");
	writeFileSync(
		globalSettingsPath,
		JSON.stringify(
			{
				defaultProvider: "openai",
				defaultModel: "gpt-4o",
				defaultThinkingLevel: "medium",
			},
			null,
			2,
		),
	);

	const savedDefaults = {
		repo: {},
		global: {},
		effective: {},
	};

	await restoreScopedModelDefaults(workspace.projectDir, savedDefaults, workspace.agentDir);

	assert.equal(existsSync(globalSettingsPath), false);
});

test("getLatestSessionStateEntryIds tracks the latest branch-local model and thinking entries", () => {
	const entries = [
		{ type: "message", id: "m1" },
		{ type: "model_change", id: "model-1" },
		{ type: "thinking_level_change", id: "thinking-1" },
		{ type: "message", id: "m2" },
		{ type: "thinking_level_change", id: "thinking-2" },
		{ type: "model_change", id: "model-2" },
	];

	assert.deepEqual(getLatestSessionStateEntryIds(entries), {
		modelEntryId: "model-2",
		thinkingEntryId: "thinking-2",
	});
});
