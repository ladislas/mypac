import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { createSeededWorkflowSessionFile } from "./workflow-sessions.ts";

function makeWorkspace() {
	const root = mkdtempSync(path.join(tmpdir(), "workflow-session-"));
	const projectDir = path.join(root, "project");
	const sessionDir = path.join(root, "sessions");
	mkdirSync(projectDir, { recursive: true });
	mkdirSync(sessionDir, { recursive: true });
	return { root, projectDir, sessionDir };
}

test("createSeededWorkflowSessionFile writes a session that restores seeded model and thinking state", async () => {
	const workspace = makeWorkspace();
	const sessionFile = await createSeededWorkflowSessionFile({
		cwd: workspace.projectDir,
		sessionDir: workspace.sessionDir,
		parentSession: "/tmp/origin.jsonl",
		sessionName: "Code Review",
		model: { provider: "test", id: "reasoner" },
		thinkingLevel: "high",
		customEntries: [{ customType: "review-session", data: { active: true, originId: "origin-1" } }],
	});

	assert.equal(existsSync(sessionFile), true);
	const lines = readFileSync(sessionFile, "utf8").trim().split("\n").map((line) => JSON.parse(line));
	assert.equal(lines[0].type, "session");
	assert.equal(lines[0].parentSession, "/tmp/origin.jsonl");
	assert.equal(lines[1].type, "model_change");
	assert.equal(lines[1].provider, "test");
	assert.equal(lines[1].modelId, "reasoner");
	assert.equal(lines[2].type, "thinking_level_change");
	assert.equal(lines[2].thinkingLevel, "high");
	assert.equal(lines[3].type, "session_info");
	assert.equal(lines[3].name, "Code Review");
	assert.equal(lines[4].type, "custom");
	assert.equal(lines[4].customType, "review-session");

	const sessionManager = SessionManager.open(sessionFile, workspace.sessionDir, workspace.projectDir);
	assert.deepEqual(sessionManager.buildSessionContext().model, { provider: "test", modelId: "reasoner" });
	assert.equal(sessionManager.buildSessionContext().thinkingLevel, "high");
	assert.equal(sessionManager.getSessionName(), "Code Review");
});
