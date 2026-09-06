import assert from "node:assert/strict";
import test from "node:test";

import { runProcess } from "./pac-eval.ts";

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

async function waitForProcessExit(pid) {
  for (let attempt = 0; attempt < 50 && processExists(pid); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return !processExists(pid);
}

test("runProcess preserves ordinary nonzero completion and output", async () => {
  const result = await runProcess(
    process.execPath,
    ["-e", "console.log('stdout'); console.error('stderr'); process.exitCode = 7"],
    { cwd: process.cwd(), timeoutMs: 1_000 },
  );

  assert.equal(result.exitCode, 7);
  assert.equal(result.signal, null);
  assert.equal(result.timedOut, false);
  assert.equal(result.stdout, "stdout\n");
  assert.equal(result.stderr, "stderr\n");
});

test("runProcess preserves direct-child SIGTERM evidence while escalating a persistent grandchild", async () => {
  const fixture = `
    const { spawn } = require("node:child_process");
    const grandchild = spawn(process.execPath, ["-e", ${JSON.stringify(`
      process.on("SIGTERM", () => {});
      console.log("persistent-grandchild-ready");
      setTimeout(() => {}, 3_000);
    `)}], { stdio: ["ignore", "inherit", "inherit"] });
    console.log("persistent-grandchild-pid=" + grandchild.pid);
    setTimeout(() => {}, 3_000);
  `;
  let grandchildPid;

  try {
    const result = await runProcess(process.execPath, ["-e", fixture], {
      cwd: process.cwd(),
      timeoutMs: 500,
    });
    grandchildPid = Number(result.stdout.match(/persistent-grandchild-pid=(\d+)/)?.[1]);

    assert.equal(result.timedOut, true);
    assert.equal(result.exitCode, null);
    assert.equal(result.signal, "SIGTERM");
    assert.match(result.stdout, /persistent-grandchild-ready/);
    assert.ok(result.durationMs >= 700, `duration ${result.durationMs}ms skipped the grace period`);
    assert.ok(result.durationMs < 1_500, `duration ${result.durationMs}ms exceeded the bounded grace period`);
    assert.ok(Number.isInteger(grandchildPid), "fixture did not report its grandchild pid");
    assert.equal(await waitForProcessExit(grandchildPid), true, "grandchild survived timeout completion");
  } finally {
    if (grandchildPid && processExists(grandchildPid)) process.kill(grandchildPid, "SIGKILL");
  }
});

test("runProcess kills a persistent child and grandchild after the timeout grace period", async () => {
  const fixture = `
    const { spawn } = require("node:child_process");
    const grandchild = spawn(process.execPath, ["-e", ${JSON.stringify(`
      process.on("SIGTERM", () => {});
      console.log("grandchild-ready");
      setTimeout(() => {}, 3_000);
    `)}], { stdio: ["ignore", "inherit", "inherit"] });
    console.log("grandchild-pid=" + grandchild.pid);
    process.on("SIGTERM", () => {});
    setTimeout(() => {}, 3_000);
  `;
  let grandchildPid;

  try {
    const result = await runProcess(process.execPath, ["-e", fixture], {
      cwd: process.cwd(),
      timeoutMs: 500,
    });
    grandchildPid = Number(result.stdout.match(/grandchild-pid=(\d+)/)?.[1]);

    assert.equal(result.timedOut, true);
    assert.match(result.stdout, /grandchild-ready/);
    assert.ok(result.durationMs >= 700, `duration ${result.durationMs}ms skipped the grace period`);
    assert.ok(result.durationMs < 1_500, `duration ${result.durationMs}ms exceeded the bounded grace period`);
    assert.ok(Number.isInteger(grandchildPid), "fixture did not report its grandchild pid");
    assert.equal(await waitForProcessExit(grandchildPid), true, "grandchild survived timeout completion");
  } finally {
    if (grandchildPid && processExists(grandchildPid)) process.kill(grandchildPid, "SIGKILL");
  }
});
