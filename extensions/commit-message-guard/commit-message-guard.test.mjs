import assert from "node:assert/strict";
import test from "node:test";

import commitMessageGuardExtension from "./index.ts";

function createGuard() {
	const handlers = new Map();
	commitMessageGuardExtension({
		on(event, handler) {
			handlers.set(event, handler);
		},
	});
	return handlers.get("tool_call");
}

test("blocks a git commit message argument containing a literal escaped newline", async () => {
	const toolCall = createGuard();
	const command = String.raw`git commit -m "🐛 fix(commit): Prevent malformed body" -m "First paragraph.\n\nVerification: npm test"`;

	const result = await toolCall({ toolName: "bash", input: { command } });

	assert.equal(result?.block, true);
	assert.match(result?.reason ?? "", /literal `\\n`/);
	assert.equal(result?.terminate, undefined);
});

test("allows real multiline commit paragraphs and unrelated escaped newlines", async () => {
	const toolCall = createGuard();
	const safeCommit = `git commit \\\n  -m "🐛 fix(commit): Prevent malformed body" \\\n  -m "First paragraph." \\\n  -m "Verification: npm test"`;
	const messageFile = String.raw`printf '%s\n' "First paragraph." "" "Verification: npm test" > /tmp/message && git commit -F /tmp/message`;

	assert.equal(await toolCall({ toolName: "bash", input: { command: safeCommit } }), undefined);
	assert.equal(await toolCall({ toolName: "bash", input: { command: messageFile } }), undefined);
	assert.equal(await toolCall({ toolName: "read", input: { path: "README.md" } }), undefined);
});
