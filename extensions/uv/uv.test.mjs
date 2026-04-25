import test from "node:test";
import assert from "node:assert/strict";
import { getBlockedCommandMessage } from "./helpers.ts";

// --- Allowed commands ---

test("allows plain uv commands", () => {
	assert.equal(getBlockedCommandMessage("uv run script.py"), null);
	assert.equal(getBlockedCommandMessage("uv add requests"), null);
	assert.equal(getBlockedCommandMessage("uv sync"), null);
});

test("allows python without blocked subcommands", () => {
	assert.equal(getBlockedCommandMessage("python script.py"), null);
	assert.equal(getBlockedCommandMessage("python3 --version"), null);
	assert.equal(getBlockedCommandMessage(".venv/bin/python script.py"), null);
});

// --- pip ---

test("blocks bare pip", () => {
	const msg = getBlockedCommandMessage("pip install requests");
	assert.ok(msg?.includes("pip is disabled"));
});

test("blocks pip3", () => {
	const msg = getBlockedCommandMessage("pip3 install requests");
	assert.ok(msg?.includes("pip3 is disabled"));
});

test("blocks pip after semicolon", () => {
	const msg = getBlockedCommandMessage("echo hi; pip install requests");
	assert.ok(msg?.includes("pip is disabled"));
});

test("blocks pip with explicit path", () => {
	const msg = getBlockedCommandMessage(".venv/bin/pip install requests");
	assert.ok(msg?.includes("pip is disabled"));
});

// --- poetry ---

test("blocks poetry", () => {
	const msg = getBlockedCommandMessage("poetry add requests");
	assert.ok(msg?.includes("poetry is disabled"));
	assert.ok(msg?.includes("uv add"));
});

// --- python -m pip ---

test("blocks python -m pip", () => {
	const msg = getBlockedCommandMessage("python -m pip install requests");
	assert.ok(msg?.includes("python -m pip' is disabled"));
});

test("blocks python3 -m pip", () => {
	const msg = getBlockedCommandMessage("python3 -m pip install requests");
	assert.ok(msg?.includes("python -m pip' is disabled"));
});

test("blocks .venv/bin/python -m pip", () => {
	const msg = getBlockedCommandMessage(".venv/bin/python -m pip install requests");
	assert.ok(msg?.includes("python -m pip' is disabled"));
});

// --- python -m venv ---

test("blocks python -m venv", () => {
	const msg = getBlockedCommandMessage("python -m venv .venv");
	assert.ok(msg?.includes("python -m venv' is disabled"));
	assert.ok(msg?.includes("uv venv"));
});

// --- python -m py_compile ---

test("blocks python -m py_compile", () => {
	const msg = getBlockedCommandMessage("python -m py_compile script.py");
	assert.ok(msg?.includes("py_compile' is disabled"));
	assert.ok(msg?.includes("uv run python -m ast"));
});

// --- multiline commands ---

test("blocks pip in multiline command", () => {
	const msg = getBlockedCommandMessage("echo start\npip install foo\necho done");
	assert.ok(msg?.includes("pip is disabled"));
});
