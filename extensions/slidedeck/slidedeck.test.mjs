import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import slidedeckExtension from "./index.ts";
import {
	buildSlidedeckPrompt,
	getNextSlidedeckRevisionPath,
	getSingleRefinementEditTargetPath,
	getSlidedeckFileUrl,
	getSlidedeckLocation,
	getSlidedeckMarkdownLink,
	getSlidedeckStateFromEntries,
	getSessionSlidedeckDir,
	isPiManagedSlidedeckFile,
	isSessionSlidedeckFile,
	parseStrictSlidedeckCopyCommand,
	renderSlidedeckHtml,
	resolveAgentDir,
} from "./helpers.ts";

function createSlidedeckGuardHarness(entries = [], sessionId = "session-123") {
	const handlers = new Map();
	const commands = new Map();
	const pi = {
		on(event, handler) { handlers.set(event, handler); },
		registerTool() {},
		registerCommand(name, definition) { commands.set(name, definition); },
		appendEntry(customType, data) { entries.push({ type: "custom", customType, data }); },
		sendUserMessage() {},
	};
	slidedeckExtension(pi);
	assert.ok(commands.has("pac-slidedeck"), "/pac-slidedeck command should be registered");
	const ctx = {
		isIdle: () => true,
		ui: { notify() {} },
		sessionManager: {
			getSessionId: () => sessionId,
			getBranch: () => entries,
		},
	};
	return {
		command: commands.get("pac-slidedeck").handler,
		toolCall: handlers.get("tool_call"),
		toolResult: handlers.get("tool_result"),
		emit: (event, payload = {}) => handlers.get(event)(payload, ctx),
		ctx,
		entries,
	};
}

test("slidedeck guard blocks mutations without terminating the agent", async () => {
	const harness = createSlidedeckGuardHarness();
	await harness.command("new deck", harness.ctx);

	const blocked = await harness.toolCall({ toolName: "write", input: { path: "deck.html" } }, harness.ctx);
	assert.equal(blocked.block, true);
	assert.match(blocked.reason, /Write is blocked/);
	assert.equal(blocked.terminate, undefined);
	assert.equal(await harness.toolCall({ toolName: "read", input: { path: "deck.html" } }, harness.ctx), undefined);
});

async function createRefinementHarness(t) {
	const sessionId = path.basename(await mkdtemp(path.join(tmpdir(), "slidedeck-test-")));
	const directory = getSessionSlidedeckDir(resolveAgentDir(), sessionId);
	await mkdir(directory, { recursive: true });
	t.after(async () => {
		await rm(directory, { recursive: true, force: true });
		await rm(path.join(tmpdir(), sessionId), { recursive: true, force: true });
	});
	const source = path.join(directory, "base.html");
	const target = path.join(directory, "base-v2.html");
	await writeFile(source, "original");
	const harness = createSlidedeckGuardHarness([], sessionId);
	await harness.command("refine", harness.ctx);
	const copy = { toolName: "bash", input: { command: `cp "${source}" "${target}"` } };
	const edit = { toolName: "edit", input: { path: target, oldText: "old", newText: "new" } };
	const copySuccessfully = async () => {
		assert.equal(await harness.toolCall(copy, harness.ctx), undefined);
		await writeFile(target, "original"); // Filesystem boundary: model the successful bash copy.
		await harness.toolResult({ ...copy, isError: false }, harness.ctx);
	};
	return { ...harness, sessionId, source, target, copy, edit, copySuccessfully };
}

test("refinement permits copy → edit → edit while rejecting original and unrelated targets", async (t) => {
	const h = await createRefinementHarness(t);
	assert.equal((await h.toolCall(h.edit, h.ctx)).block, true);
	await h.copySuccessfully();
	for (let i = 0; i < 2; i++) {
		assert.equal(await h.toolCall(h.edit, h.ctx), undefined, `edit ${i + 1} should be permitted`);
		await h.toolResult({ ...h.edit, isError: false }, h.ctx);
	}
	for (const target of [h.source, path.join(path.dirname(h.target), "other.html"), "/tmp/unrelated.html"]) {
		assert.equal((await h.toolCall({ ...h.edit, input: { ...h.edit.input, path: target } }, h.ctx)).block, true);
	}
	assert.equal((await h.toolCall(h.copy, h.ctx)).block, true);
});

for (const stopReason of ["stop", "aborted", "error"]) {
	test(`refinement retires authorization on agent_end (${stopReason})`, async (t) => {
		const h = await createRefinementHarness(t);
		await h.copySuccessfully();
		await h.toolResult({ ...h.edit, isError: false }, h.ctx);
		await h.emit("agent_end", { messages: [{ role: "assistant", stopReason }] });
		assert.deepEqual(h.entries.at(-1).data, { currentDeckPath: h.target, pendingDeckPath: undefined });
		// Late results cannot reauthorize a retired run.
		await h.toolResult({ ...h.copy, isError: false }, h.ctx);
		await h.command("refine again", h.ctx);
		assert.equal((await h.toolCall(h.edit, h.ctx)).block, true);
		const nextCopy = { toolName: "bash", input: { command: `cp "${h.target}" "${path.join(path.dirname(h.target), "base-v3.html")}"` } };
		assert.equal(await h.toolCall(nextCopy, h.ctx), undefined);
	});
}

test("failed copy grants no authorization; failed edit remains retryable until run failure", async (t) => {
	const h = await createRefinementHarness(t);
	assert.equal(await h.toolCall(h.copy, h.ctx), undefined);
	await h.toolResult({ ...h.copy, isError: true }, h.ctx);
	assert.equal((await h.toolCall(h.edit, h.ctx)).block, true);
	assert.equal(h.entries.length, 0);
	await h.copySuccessfully();
	await h.toolResult({ ...h.edit, isError: true }, h.ctx);
	assert.equal(await h.toolCall(h.edit, h.ctx), undefined);
	assert.equal(h.entries.at(-1).data.currentDeckPath, h.source);
	await h.emit("agent_end", { messages: [{ role: "assistant", stopReason: "error" }] });
	await h.command("retry", h.ctx);
	assert.equal((await h.toolCall(h.edit, h.ctx)).block, true);
	assert.equal(h.entries.at(-1).data.currentDeckPath, h.source);
});

for (const event of ["session_start", "session_tree"]) {
	test(`${event} restores a pending copy only for explicit scoped resumption`, async (t) => {
		const h = await createRefinementHarness(t);
		await h.copySuccessfully();
		await h.toolResult({ ...h.edit, isError: false }, h.ctx);
		await h.emit("session_shutdown");
		const restored = createSlidedeckGuardHarness(h.entries, h.sessionId);
		await restored.emit(event);
		const count = h.entries.length;
		await restored.toolResult({ ...h.copy, isError: false }, restored.ctx);
		assert.equal(h.entries.length, count, "inactive results must not change restored state");
		await restored.command("resume refinement", restored.ctx);
		assert.equal((await restored.toolCall(h.copy, restored.ctx)).block, true);
		assert.equal((await restored.toolCall({ ...h.edit, input: { ...h.edit.input, path: h.source } }, restored.ctx)).block, true);
		for (let i = 0; i < 2; i++) {
			assert.equal(await restored.toolCall(h.edit, restored.ctx), undefined);
			await restored.toolResult({ ...h.edit, isError: false }, restored.ctx);
		}
		await restored.emit("agent_end");
		await restored.emit(event);
		await restored.command("another refinement", restored.ctx);
		assert.equal((await restored.toolCall(h.edit, restored.ctx)).block, true);
	});
}

test("refinement still rejects invalid copies and multi-target edits", async (t) => {
	const h = await createRefinementHarness(t);
	for (const command of [
		`cp "${h.source}" "${h.source}"`,
		`cp "${h.source}" "${path.join(path.dirname(h.target), "base-v3.html")}"`,
		`cp /tmp/not-managed.html "${h.target}"`,
		`cp "${h.source}" /tmp/outside-v2.html`,
	]) {
		assert.equal((await h.toolCall({ toolName: "bash", input: { command } }, h.ctx)).block, true);
	}
	await h.copySuccessfully();
	assert.equal((await h.toolCall({ toolName: "write", input: { path: h.target } }, h.ctx)).block, true);
	assert.equal((await h.toolCall({ toolName: "edit", input: { multi: [h.edit.input, { ...h.edit.input, path: h.source }] } }, h.ctx)).block, true);
	assert.equal((await h.toolCall({ toolName: "edit", input: { patch: `*** Begin Patch\n*** Update File: ${h.target}\n@@\n-old\n+new\n*** Update File: ${h.source}\n@@\n-old\n+new\n*** End Patch` } }, h.ctx)).block, true);
});

test("buildSlidedeckPrompt uses provided source material at the end", () => {
	const prompt = buildSlidedeckPrompt("Issue #131: explain the HTML deck workflow", {
		sessionDeckDir: "/Users/tester/.pi/agent/slidedecks/session-123",
		currentDeckPath: "/Users/tester/.pi/agent/slidedecks/session-123/20260428-123456-deck-for-issue-131.html",
		pendingDeckPath: "/Users/tester/.pi/agent/slidedecks/session-123/20260428-123456-deck-for-issue-131-v2.html",
	});
	assert.match(prompt, /Use the save_slidedeck tool exactly once/);
	assert.match(prompt, /### New deck creation/);
	assert.match(prompt, /### Deck refinement/);
	assert.match(prompt, /Never use save_slidedeck for refinement/);
	assert.match(prompt, /exactly one bash command in the form `cp <source\.html> <target-vN\.html>`/);
	assert.match(prompt, /Allow only plain edit, edit\.multi, or a single-file edit\.patch `Update File`/);
	assert.match(prompt, /Use these patterns exactly/);
	assert.match(prompt, /A Markdown link in the exact format `\[slidedeck\]\(<saved file path>\)`/);
	assert.match(prompt, /Preserve untouched slides and content/);
	assert.match(prompt, /Current deck tracked for this session: \/Users\/tester\/\.pi\/agent\/slidedecks\/session-123\/20260428-123456-deck-for-issue-131\.html/);
	assert.match(prompt, /Pending fresh refinement copy for this session: \/Users\/tester\/\.pi\/agent\/slidedecks\/session-123\/20260428-123456-deck-for-issue-131-v2\.html/);
	assert.match(prompt, /Current session deck directory: \/Users\/tester\/\.pi\/agent\/slidedecks\/session-123/);
	assert.ok(prompt.endsWith("Source material:\nIssue #131: explain the HTML deck workflow"));
});

test("buildSlidedeckPrompt falls back to conversation context", () => {
	const prompt = buildSlidedeckPrompt("   ");
	assert.ok(prompt.endsWith("Source material:\nUse the current conversation context."));
});

test("resolveAgentDir honors explicit Pi agent env vars and tilde expansion", () => {
	assert.equal(resolveAgentDir({ PI_CODING_AGENT_DIR: "~/custom-agent" }, "/Users/tester"), "/Users/tester/custom-agent");
	assert.equal(resolveAgentDir({ ACME_CODING_AGENT_DIR: "/tmp/acme-agent" }, "/Users/tester"), "/tmp/acme-agent");
	assert.equal(resolveAgentDir({}, "/Users/tester"), "/Users/tester/.pi/agent");
});

test("getSlidedeckLocation stores decks under the shared Pi slidedecks dir", () => {
	assert.equal(getSessionSlidedeckDir("/Users/tester/.pi/agent", "session-123"), "/Users/tester/.pi/agent/slidedecks/session-123");

	const location = getSlidedeckLocation({
		agentDir: "/Users/tester/.pi/agent",
		sessionId: "session-123",
		title: "Deck for Issue 131",
		timestamp: new Date("2026-04-28T12:34:56Z"),
	});

	assert.equal(location.dir, "/Users/tester/.pi/agent/slidedecks/session-123");
	assert.equal(location.file, "/Users/tester/.pi/agent/slidedecks/session-123/20260428-123456-deck-for-issue-131.html");
});

test("isSessionSlidedeckFile only allows HTML decks in the current session dir", () => {
	const sessionDeckDir = "/Users/tester/.pi/agent/slidedecks/session-123";

	assert.equal(isSessionSlidedeckFile(`${sessionDeckDir}/deck-v2.html`, sessionDeckDir), true);
	assert.equal(isSessionSlidedeckFile(`${sessionDeckDir}/notes.txt`, sessionDeckDir), false);
	assert.equal(isSessionSlidedeckFile("/Users/tester/.pi/agent/slidedecks/session-999/deck.html", sessionDeckDir), false);
	assert.equal(isSessionSlidedeckFile("/Users/tester/dev/mypac/deck.html", sessionDeckDir), false);
});

test("isPiManagedSlidedeckFile allows decks from any Pi-managed session dir", () => {
	const agentDir = "/Users/tester/.pi/agent";

	assert.equal(isPiManagedSlidedeckFile("/Users/tester/.pi/agent/slidedecks/session-123/deck.html", agentDir), true);
	assert.equal(isPiManagedSlidedeckFile("/Users/tester/.pi/agent/slidedecks/session-999/deck-v2.html", agentDir), true);
	assert.equal(isPiManagedSlidedeckFile("/Users/tester/.pi/agent/notes/deck.html", agentDir), false);
});

test("getNextSlidedeckRevisionPath picks the next fresh revision in the current session dir", () => {
	assert.equal(
		getNextSlidedeckRevisionPath(
			"/Users/tester/.pi/agent/slidedecks/session-999/20260428-123456-review-deck.html",
			"/Users/tester/.pi/agent/slidedecks/session-123",
			[
				"20260428-123456-review-deck.html",
				"20260428-123456-review-deck-v2.html",
				"20260428-123456-review-deck-v3.html",
			],
		),
		"/Users/tester/.pi/agent/slidedecks/session-123/20260428-123456-review-deck-v4.html",
	);
	assert.equal(
		getNextSlidedeckRevisionPath(
			"/Users/tester/.pi/agent/slidedecks/session-123/20260428-123456-review-deck-v4.html",
			"/Users/tester/.pi/agent/slidedecks/session-123",
			["20260428-123456-review-deck-v2.html", "20260428-123456-review-deck-v4.html"],
		),
		"/Users/tester/.pi/agent/slidedecks/session-123/20260428-123456-review-deck-v5.html",
	);
});

test("getSlidedeckStateFromEntries restores current and pending refinement state", () => {
	const state = getSlidedeckStateFromEntries([
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "save_slidedeck",
				details: { path: "/Users/tester/.pi/agent/slidedecks/session-123/base.html" },
			},
		},
		{
			type: "custom",
			customType: "slidedeck-state",
			data: {
				currentDeckPath: "/Users/tester/.pi/agent/slidedecks/session-123/base.html",
				pendingDeckPath: "/Users/tester/.pi/agent/slidedecks/session-123/base-v2.html",
			},
		},
		{
			type: "custom",
			customType: "slidedeck-state",
			data: {
				currentDeckPath: "/Users/tester/.pi/agent/slidedecks/session-123/base-v2.html",
			},
		},
	]);

	assert.deepEqual(state, {
		currentDeckPath: "/Users/tester/.pi/agent/slidedecks/session-123/base-v2.html",
	});
});

test("getSingleRefinementEditTargetPath supports plain, multi, and single-file patch updates only", () => {
	assert.equal(
		getSingleRefinementEditTargetPath({
			path: "/Users/tester/.pi/agent/slidedecks/session-123/base-v2.html",
			oldText: "old",
			newText: "new",
		}),
		"/Users/tester/.pi/agent/slidedecks/session-123/base-v2.html",
	);
	assert.equal(
		getSingleRefinementEditTargetPath({
			path: "/Users/tester/.pi/agent/slidedecks/session-123/base-v2.html",
			multi: [
				{ oldText: "old", newText: "new" },
				{ path: "/Users/tester/.pi/agent/slidedecks/session-123/base-v2.html", oldText: "before", newText: "after" },
			],
		}),
		"/Users/tester/.pi/agent/slidedecks/session-123/base-v2.html",
	);
	assert.equal(
		getSingleRefinementEditTargetPath({
			patch: [
				"*** Begin Patch",
				"*** Update File: /Users/tester/.pi/agent/slidedecks/session-123/base-v2.html",
				"@@",
				"-old",
				"+new",
				"*** End Patch",
			].join("\n"),
		}),
		"/Users/tester/.pi/agent/slidedecks/session-123/base-v2.html",
	);
	assert.equal(
		getSingleRefinementEditTargetPath({
			multi: [
				{ path: "/Users/tester/.pi/agent/slidedecks/session-123/base-v2.html", oldText: "a", newText: "b" },
				{ path: "/Users/tester/.pi/agent/slidedecks/session-123/other.html", oldText: "c", newText: "d" },
			],
		}),
		undefined,
	);
	assert.equal(
		getSingleRefinementEditTargetPath({
			patch: [
				"*** Begin Patch",
				"*** Add File: /Users/tester/.pi/agent/slidedecks/session-123/base-v3.html",
				"+new file",
				"*** End Patch",
			].join("\n"),
		}),
		undefined,
	);
});

test("parseStrictSlidedeckCopyCommand only accepts a bare two-argument cp command", () => {
	assert.deepEqual(
		parseStrictSlidedeckCopyCommand('cp "/Users/tester/.pi/agent/slidedecks/session-123/base.html" "/Users/tester/.pi/agent/slidedecks/session-123/base-v2.html"'),
		{
			sourcePath: "/Users/tester/.pi/agent/slidedecks/session-123/base.html",
			targetPath: "/Users/tester/.pi/agent/slidedecks/session-123/base-v2.html",
		},
	);
	assert.equal(parseStrictSlidedeckCopyCommand("cp a.html b.html && echo done"), undefined);
});

test("getSlidedeckFileUrl converts saved paths to file URLs", () => {
	assert.equal(
		getSlidedeckFileUrl("/Users/tester/.pi/agent/slidedecks/session-123/deck.html"),
		"file:///Users/tester/.pi/agent/slidedecks/session-123/deck.html",
	);
});

test("getSlidedeckMarkdownLink formats a clickable markdown link", () => {
	assert.equal(
		getSlidedeckMarkdownLink("/Users/tester/.pi/agent/slidedecks/session-123/deck.html"),
		"[Open slidedeck](file:///Users/tester/.pi/agent/slidedecks/session-123/deck.html)",
	);
	assert.equal(
		getSlidedeckMarkdownLink("/Users/tester/.pi/agent/slidedecks/session-123/deck.html", "Open visual QA sample"),
		"[Open visual QA sample](file:///Users/tester/.pi/agent/slidedecks/session-123/deck.html)",
	);
});

test("renderSlidedeckHtml wraps slides in the shared template", () => {
	const html = renderSlidedeckHtml({
		title: "Review Deck",
		slides: [
			{ title: "Overview & Goals", body: "<p>Summarize the <a href=\"https://example.com\">work</a>.</p>" },
			{ title: "Next Steps", body: "<ul><li>Ship it</li></ul>" },
		],
		generatedAt: new Date("2026-04-28T12:34:56Z"),
	});

	assert.match(html, /<title>Review Deck<\/title>/);
	assert.match(html, /class="deck" data-title="Review Deck"/);
	assert.match(html, /class="footer"/);
	assert.match(html, /class="progress"><div><\/div><\/div>/);
	assert.match(html, /class="nav"/);
	assert.match(html, /<button id="next">Next →<\/button>/);
	assert.match(html, /<h1 class="slide-title">Overview &amp; Goals<\/h1>/);
	assert.match(html, /<h2 class="slide-title">Next Steps<\/h2>/);
	assert.match(html, /<div class="eyebrow">Slide 1<\/div>/);
	assert.match(html, /<p>Summarize the <a href="https:\/\/example\.com">work<\/a>\.<\/p>/);
	assert.match(html, /a,\s*a:visited\s*\{\s*color: var\(--accent\);/);
	assert.match(html, /a:hover,\s*a:focus-visible\s*\{\s*color: var\(--accent-2\);/);
	assert.doesNotMatch(html, /class="slide-body"/);
	assert.match(html, /<script>\s*const deck = document\.querySelector/);
});
