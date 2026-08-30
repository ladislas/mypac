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

test("blocks attached short message arguments containing literal escaped newlines", async () => {
	const toolCall = createGuard();
	const commands = [
		String.raw`git commit -m"Subject.\nBody."`,
		String.raw`git -C /tmp/repo commit -mSubject.\nBody.`,
	];

	for (const command of commands) {
		const result = await toolCall({ toolName: "bash", input: { command } });
		assert.equal(result?.block, true, command);
		assert.match(result?.reason ?? "", /literal `\\n`/);
	}
});

test("blocks literal escaped newlines after generic Git long modifiers", async () => {
	const toolCall = createGuard();
	const command = String.raw`git --no-advice commit -m"Subject.\nBody."`;

	const result = await toolCall({ toolName: "bash", input: { command } });

	assert.equal(result?.block, true);
	assert.match(result?.reason ?? "", /literal `\\n`/);
});

test("blocks literal escaped newlines when git global options precede commit", async () => {
	const toolCall = createGuard();
	const command = String.raw`git -C "/tmp/example repo" commit -m "🐛 fix(commit): Prevent malformed body" -m "First paragraph.\n\nRefs #425"`;

	const result = await toolCall({ toolName: "bash", input: { command } });

	assert.equal(result?.block, true);
	assert.match(result?.reason ?? "", /literal `\\n`/);
});

test("blocks malformed commit messages in chained executable commands", async () => {
	const toolCall = createGuard();
	const commands = [
		String.raw`cd /tmp && git --no-advice commit -m"Subject.\nBody."`,
		String.raw`cd /tmp && \
  git --no-advice commit -m"Subject.\nBody."`,
	];

	for (const command of commands) {
		const result = await toolCall({ toolName: "bash", input: { command } });
		assert.equal(result?.block, true, command);
	}
});

test("allows quoted Git commit examples that are not executed", async () => {
	const toolCall = createGuard();
	const commands = [
		String.raw`rg 'git commit -m"Subject.\nBody."' .`,
		String.raw`printf '%s\n' 'git --no-advice commit -m"Subject.\nBody."'`,
		String.raw`printf '%s\n' 'docs; git commit -m"Subject.\nBody."'`,
	];

	for (const command of commands) {
		assert.equal(await toolCall({ toolName: "bash", input: { command } }), undefined, command);
	}
});

test("allows real multiline commit paragraphs and unrelated escaped newlines", async () => {
	const toolCall = createGuard();
	const safeCommit = `git commit \\\n  -m "🐛 fix(commit): Prevent malformed body" \\\n  -m "First paragraph." \\\n  -m "Verification: npm test"`;
	const messageFile = String.raw`printf '%s\n' "First paragraph." "" "Verification: npm test" > /tmp/message && git commit -F /tmp/message`;

	assert.equal(await toolCall({ toolName: "bash", input: { command: safeCommit } }), undefined);
	assert.equal(await toolCall({ toolName: "bash", input: { command: messageFile } }), undefined);
	assert.equal(await toolCall({ toolName: "read", input: { path: "README.md" } }), undefined);
});
