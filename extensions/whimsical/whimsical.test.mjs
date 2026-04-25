import test from "node:test";
import assert from "node:assert/strict";
import { messages, pickRandom } from "./helpers.ts";

test("pickRandom returns a non-empty string", () => {
  const result = pickRandom();
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0);
});

test("pickRandom returns a value from the messages array", () => {
  // Run a few times to reduce flakiness
  for (let i = 0; i < 20; i++) {
    const result = pickRandom();
    assert.ok(messages.includes(result), `"${result}" not found in messages`);
  }
});

test("messages array is non-empty", () => {
  assert.ok(messages.length > 0);
});

test("all messages end with '...'", () => {
  for (const msg of messages) {
    assert.ok(msg.endsWith("..."), `Expected "${msg}" to end with "..."`);
  }
});
