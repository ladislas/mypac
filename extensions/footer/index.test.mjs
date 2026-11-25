import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SessionManager } from "@earendil-works/pi-coding-agent";

import registerFooterExtension from "./index.ts";
import { HEADROOM_FOOTER_STATE_EVENT } from "../headroom/state.ts";

function createEventBus() {
	const handlers = new Map();
	return {
		emit(channel, data) {
			for (const handler of handlers.get(channel) ?? []) handler(data);
		},
		on(channel, handler) {
			const list = handlers.get(channel) ?? [];
			list.push(handler);
			handlers.set(channel, list);
			return () => handlers.set(channel, (handlers.get(channel) ?? []).filter((item) => item !== handler));
		},
	};
}

function createHarness(mode = "tui", sessionManager) {
	const events = new Map();
	let footerFactory;
	let footerCalls = 0;
	let renderRequests = 0;
	const eventBus = createEventBus();
	const pi = {
		events: eventBus,
		on: (event, handler) => events.set(event, handler),
		getThinkingLevel: () => "medium",
	};
	const ctx = {
		mode,
		hasUI: mode === "tui" || mode === "rpc",
		model: { provider: "openai-codex", id: "gpt-5.5", reasoning: true },
		modelRegistry: { isUsingOAuth: () => false },
		getContextUsage: () => undefined,
		sessionManager: sessionManager ?? {
			getCwd: () => "/repo",
			getSessionId: () => "abc123456789",
			getSessionName: () => undefined,
			getEntries: () => [],
		},
		ui: {
			setFooter: (factory) => {
				footerCalls++;
				footerFactory = factory;
			},
		},
	};
	const footerData = {
		getGitBranch: () => "main",
		onBranchChange: () => () => {},
	};
	const tui = { requestRender: () => { renderRequests++; } };
	const theme = { fg: (_color, text) => text };

	registerFooterExtension(pi);
	events.get("session_start")({ type: "session_start" }, ctx);
	const footer = footerFactory?.(tui, theme, footerData);

	return { eventBus, footer, footerCalls, get renderRequests() { return renderRequests; } };
}

test("footer updates Headroom indicator from shared event bus", () => {
	const harness = createHarness();

	assert.match(harness.footer.render(80).join("\n"), /Headroom - \(0\/0%\)/);

	harness.eventBus.emit(HEADROOM_FOOTER_STATE_EVENT, { status: "working", tokensSaved: 1234, compressionPercent: 17.6 });

	assert.equal(harness.renderRequests, 1);
	assert.match(harness.footer.render(80).join("\n"), /Headroom ✓ \(1\.2k\/18%\)/);
	harness.footer.dispose();
});

test("footer counts persisted cache warms once across branches", async (t) => {
	const dir = await mkdtemp(join(tmpdir(), "mypac-footer-"));
	t.after(() => rm(dir, { recursive: true, force: true }));
	const session = SessionManager.create("/repo", dir);
	const usage = (input, output, cacheRead, cacheWrite, cost) => ({
		input, output, cacheRead, cacheWrite, totalTokens: input + output + cacheRead + cacheWrite,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: cost, total: cost, totalFromProvider: false },
	});
	const assistantId = session.appendMessage({
		role: "assistant", content: [], api: "anthropic-messages", provider: "anthropic", model: "claude",
		usage: usage(10, 5, 3, 2, 0.015), stopReason: "stop", timestamp: Date.now(),
	});
	const render = () => {
		const { footer } = createHarness("tui", SessionManager.open(session.getSessionFile()));
		try { return footer.render(100).join("\n"); }
		finally { footer.dispose(); }
	};
	assert.match(render(), /↑10 ↓5 R3 W2 \$0\.015/);

	session.appendUsage("cache_warm", "anthropic", "claude", usage(1, 0, 30, 20, 0.015));
	assert.match(render(), /↑11 ↓5 R33 W22 \$0\.030/);

	session.branch(assistantId);
	session.appendUsage("cache_warm", "openai", "gpt", usage(2, 1, 4, 0, 0.002));
	session.appendCompaction("summary", assistantId, 20, undefined, false, usage(3, 2, 0, 0, 0.003));
	assert.match(render(), /↑16 ↓8 R37 W22 \$0\.035/);
});

test("footer does not install a component factory in RPC mode", () => {
	const harness = createHarness("rpc");

	assert.equal(harness.footerCalls, 0);
	assert.equal(harness.footer, undefined);
});
