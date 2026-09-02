import test from "node:test";
import assert from "node:assert/strict";
import { buildPiSlidedeckPrompt, getPortableSlidedeckGuidance } from "./skill-guidance.ts";

test("portable slidedeck guidance stays host-neutral", () => {
	const guidance = getPortableSlidedeckGuidance();

	assert.match(guidance, /Turn source material into a presentation/i);
	assert.match(guidance, /4–10 focused slides/i);
	assert.match(guidance, /host environment's native presentation or artifact capability/i);
	assert.match(guidance, /preserve untouched slides verbatim/i);
	assert.doesNotMatch(guidance, /save_slidedeck|~\/\.pi|\/pac-slidedeck|class=|Pi-specific/i);
});

test("Pi slidedeck prompt composes canonical guidance before runtime-specific rules", () => {
	const prompt = buildPiSlidedeckPrompt("Leadership rollout recommendation", {
		sessionDeckDir: "/Users/tester/.pi/agent/slidedecks/session-123",
		currentDeckPath: "/Users/tester/.pi/agent/slidedecks/session-123/deck.html",
	});

	const canonical = prompt.indexOf("## Canonical presentation guidance");
	const runtime = prompt.indexOf("## Pi-specific HTML workflow");
	assert.ok(canonical >= 0);
	assert.ok(runtime > canonical);
	assert.match(prompt, /Use the save_slidedeck tool exactly once/);
	assert.match(prompt, /Use these patterns exactly/);
	assert.ok(prompt.endsWith("Source material:\nLeadership rollout recommendation"));
});
