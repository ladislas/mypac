import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, watch, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { PINNED_PI_VERSION, buildPiInvocation, collectRunSessionTelemetry, parseManifest, runEvaluation } from "./pac-eval.ts";

const execFileAsync = promisify(execFile);

test("collectRunSessionTelemetry represents complete and unavailable Pi telemetry explicitly", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pac-eval-telemetry-"));
  await writeFile(join(directory, "session.jsonl"), [
    JSON.stringify({ type: "session", id: "eval-session", timestamp: "2026-01-01T00:00:00.000Z", cwd: "/tmp/repo" }),
    JSON.stringify({ type: "model_change", provider: "openai-codex", modelId: "gpt-requested" }),
    JSON.stringify({ type: "thinking_level_change", thinkingLevel: "high" }),
    JSON.stringify({ type: "message", message: { role: "user", content: "work" } }),
    JSON.stringify({ type: "message", message: { role: "assistant", provider: "openai-codex", model: "gpt-actual", usage: {
      input: 10, output: 5, cacheRead: 3, cacheWrite: 2, totalTokens: 20,
      contextTokens: 15, maxContextTokens: 100, cost: { total: 0.2 },
    } } }),
  ].join("\n"));

  assert.deepEqual(await collectRunSessionTelemetry(directory), {
    sessions: [{ file: "session.jsonl", id: "eval-session", startedAt: "2026-01-01T00:00:00.000Z", cwd: "/tmp/repo" }],
    messages: 2,
    assistantTurns: 1,
    tokens: { input: 10, output: 5, cacheRead: 3, cacheWrite: 2, total: 20 },
    cost: { reported: 0.2, estimated: null, total: 0.2, currency: "USD" },
    context: { samples: [15], initial: 15, peak: 15, final: 15, max: 100 },
    modelsUsed: ["openai-codex/gpt-actual", "openai-codex/gpt-requested"],
    thinkingLevelsUsed: ["high"],
    actualConfiguration: { provider: "openai-codex", model: "gpt-actual", thinking: "high" },
    malformedLines: 0,
  });

  const supportedDirectory = join(directory, "supported-estimate");
  await mkdir(supportedDirectory);
  await writeFile(join(supportedDirectory, "session.jsonl"), [
    JSON.stringify({ type: "session", timestamp: "2026-01-01T00:00:00.000Z" }),
    JSON.stringify({ type: "message", message: { role: "assistant", provider: "github-copilot", model: "claude-sonnet", usage: { input: 1_000_000, output: 100_000 } } }),
  ].join("\n"));
  assert.deepEqual((await collectRunSessionTelemetry(supportedDirectory)).cost, {
    reported: null, estimated: 4.5, total: 4.5, currency: "USD",
  });

  const unsupportedDirectory = join(directory, "unsupported-estimate");
  await mkdir(unsupportedDirectory);
  await writeFile(join(unsupportedDirectory, "session.jsonl"), [
    JSON.stringify({ type: "session", timestamp: "2026-01-01T00:00:00.000Z" }),
    JSON.stringify({ type: "message", message: { role: "assistant", provider: "unknown-provider", model: "unknown-model", usage: { input: 10, output: 5, totalTokens: 15 } } }),
  ].join("\n"));
  assert.deepEqual((await collectRunSessionTelemetry(unsupportedDirectory)).cost, {
    reported: null, estimated: null, total: null, currency: "USD",
  });

  const noUsageDirectory = join(directory, "no-usage");
  await mkdir(noUsageDirectory);
  await writeFile(join(noUsageDirectory, "session.jsonl"), JSON.stringify({
    type: "session", timestamp: "2026-01-01T00:00:00.000Z",
  }));
  assert.deepEqual((await collectRunSessionTelemetry(noUsageDirectory)).cost, {
    reported: null, estimated: null, total: null, currency: "USD",
  });

  assert.deepEqual(await collectRunSessionTelemetry(join(directory, "missing")), {
    sessions: [], messages: null, assistantTurns: null,
    tokens: { input: null, output: null, cacheRead: null, cacheWrite: null, total: null },
    cost: { reported: null, estimated: null, total: null, currency: "USD" },
    context: { samples: [], initial: null, peak: null, final: null, max: null },
    modelsUsed: [], thinkingLevelsUsed: [],
    actualConfiguration: { provider: null, model: null, thinking: null },
    malformedLines: 0,
  });
});

async function writeManifest(directory, manifest) {
  const path = join(directory, "evaluation.json");
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
  return path;
}

function validManifest(repository, outputDirectory) {
  return {
    version: 1,
    id: "smoke",
    outputDirectory,
    repository: { path: repository, ref: "HEAD" },
    profiles: [
      { id: "control", model: "openai-codex/gpt-5.4", thinking: "medium" },
      {
        id: "candidate",
        model: "openai-codex/gpt-5.4",
        thinking: "high",
        workflow: "/pac-lwot",
        execution: { tools: ["read", "bash", "edit", "write", "grep", "find", "ls"] },
        package: {
          path: repository,
          ref: "HEAD",
          resources: { prompts: ["prompts"], skills: ["skills"] },
        },
      },
    ],
    scenarios: [
      {
        id: "narrow-change",
        prompt: "Make the requested change.",
        timeoutMs: 1000,
        verify: [{ command: "node", args: ["--version"], timeoutMs: 500 }],
        artifacts: ["result.txt"],
      },
    ],
  };
}

test("manifest validation rejects unsupported thinking levels and unsafe artifact paths", () => {
  const manifest = validManifest("/tmp/source", "/tmp/output");
  manifest.profiles[0].thinking = "ultra";
  assert.throws(() => parseManifest(manifest), /thinking is not supported/);

  manifest.profiles[0].thinking = "medium";
  manifest.scenarios[0].artifacts = ["../secret"];
  assert.throws(() => parseManifest(manifest), /must stay inside/);

  manifest.scenarios[0].artifacts = [];
  manifest.profiles[1].execution.tools = ["bash", "publish"];
  assert.throws(() => parseManifest(manifest), /unsupported built-in tool publish/);

  manifest.profiles[1].execution.tools = ["bash"];
  manifest.profiles[1].package.resources.extensions = ["../host-extension.ts"];
  assert.throws(() => parseManifest(manifest), /must stay inside the resolved package/);
});

test("pinned Pi invocation uses JSON mode, explicit model/thinking, a fresh session directory, and safe tools", () => {
  const invocation = buildPiInvocation(
    { id: "profile", model: "openai-codex/gpt-5.4", thinking: "high", workflow: "/pac-lwot" },
    "/tmp/session",
    "Change one file.",
  );

  assert.equal(invocation.command, process.execPath);
  assert.match(invocation.args[0], /@earendil-works\/pi-coding-agent\/dist\/bundle\/cli\.js$/);
  assert.deepEqual(invocation.args.slice(1), [
    "--mode", "json",
    "--model", "openai-codex/gpt-5.4",
    "--thinking", "high",
    "--session-dir", "/tmp/session",
    "--tools", "read,edit,write,grep,find,ls",
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-themes",
    "--approve",
    "--",
    "/pac-lwot Change one file.",
  ]);
});

test("trusted implementation policy explicitly enables bash and selected package resources", () => {
  const invocation = buildPiInvocation(
    {
      id: "implementation",
      model: "openai-codex/gpt-5.4",
      thinking: "high",
      execution: { tools: ["read", "bash", "edit", "write", "grep", "find", "ls"] },
      package: {
        path: "/source/mypac",
        ref: "candidate",
        resources: {
          prompts: ["prompts"],
          skills: ["skills/pac-tdd"],
          extensions: ["extensions/shared-append-system/index.ts"],
        },
      },
    },
    "/tmp/session",
    "Implement the change.",
    "/tmp/package",
  );

  assert.deepEqual(invocation.args.slice(1), [
    "--mode", "json",
    "--model", "openai-codex/gpt-5.4",
    "--thinking", "high",
    "--session-dir", "/tmp/session",
    "--tools", "read,bash,edit,write,grep,find,ls",
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-themes",
    "--skill", "/tmp/package/skills/pac-tdd",
    "--prompt-template", "/tmp/package/prompts",
    "--extension", "/tmp/package/extensions/shared-append-system/index.ts",
    "--approve", "--", "Implement the change.",
  ]);
});

test("dry-run validates and previews the expanded matrix without launching Pi", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pac-eval-dry-"));
  const repository = join(directory, "repository");
  const outputDirectory = join(directory, "output");
  const manifestPath = await writeManifest(directory, validManifest(repository, outputDirectory));

  const { stdout } = await execFileAsync(
    process.execPath,
    ["--experimental-strip-types", "scripts/pac-eval.ts", manifestPath, "--dry-run"],
    { cwd: process.cwd() },
  );
  const preview = JSON.parse(stdout);

  assert.equal(preview.evaluationId, "smoke");
  assert.deepEqual(preview.scenarios, ["narrow-change"]);
  assert.deepEqual(preview.profiles, ["control", "candidate"]);
  assert.equal(preview.totalRuns, 2);
  assert.deepEqual(
    preview.runs.map(({ scenarioId, profileId, model, thinking }) => ({ scenarioId, profileId, model, thinking })),
    [
      {
        scenarioId: "narrow-change",
        profileId: "control",
        model: "openai-codex/gpt-5.4",
        thinking: "medium",
      },
      {
        scenarioId: "narrow-change",
        profileId: "candidate",
        model: "openai-codex/gpt-5.4",
        thinking: "high",
      },
    ],
  );
  assert.deepEqual(preview.runs[0].tools, ["read", "edit", "write", "grep", "find", "ls"]);
  assert.deepEqual(preview.runs[1].tools, ["read", "bash", "edit", "write", "grep", "find", "ls"]);
  assert.deepEqual(preview.runs[1].packageResources, { prompts: ["prompts"], skills: ["skills"] });
  assert.equal(preview.outputDirectory, outputDirectory);
});

async function initializeRepository(path) {
  await mkdir(path, { recursive: true });
  await execFileAsync("git", ["init", "-q", "-b", "main"], { cwd: path });
  await execFileAsync("git", ["config", "user.name", "Eval Fixture"], { cwd: path });
  await execFileAsync("git", ["config", "user.email", "eval@example.test"], { cwd: path });
  await writeFile(join(path, "README.md"), "fixture\n");
  await execFileAsync("git", ["add", "README.md"], { cwd: path });
  await execFileAsync("git", ["commit", "-q", "-m", "fixture"], { cwd: path });
  return (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: path })).stdout.trim();
}

async function writeFakePi(path) {
  await writeFile(path, `
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
const args = process.argv.slice(2);
const value = (flag) => args[args.indexOf(flag) + 1];
const sessionDir = value("--session-dir");
const requestedModel = value("--model");
const thinking = value("--thinking");
const [provider, ...modelParts] = requestedModel.split("/");
const model = process.env.FAKE_MISMATCH === "1" ? "different-model" : modelParts.join("/");
await mkdir(sessionDir, { recursive: true });
await writeFile(join(sessionDir, "session.jsonl"), [
  JSON.stringify({ type: "session", version: 3, id: "fixture", timestamp: "2026-01-01T00:00:00.000Z", cwd: process.cwd() }),
  JSON.stringify({ type: "model_change", id: "1", parentId: null, timestamp: "2026-01-01T00:00:00.000Z", provider, modelId: model }),
  JSON.stringify({ type: "thinking_level_change", id: "2", parentId: "1", timestamp: "2026-01-01T00:00:00.000Z", thinkingLevel: thinking }),
  JSON.stringify({ type: "message", id: "3", message: { role: "user", content: "fixture prompt" } }),
  JSON.stringify({ type: "message", id: "4", message: { role: "assistant", provider, model, usage: { input: 10, output: 5, cacheRead: 3, cacheWrite: 2, totalTokens: 20, contextTokens: 15, maxContextTokens: 100, cost: { total: 0.2 } } } }),
].join("\\n") + "\\n");
if (process.env.EVIDENCE_MODE) {
  if (["committed-only", "mixed"].includes(process.env.EVIDENCE_MODE)) {
    await writeFile("committed.txt", "committed change\\n");
    execFileSync("git", ["add", "committed.txt"]);
    execFileSync("git", ["commit", "-q", "-m", "committed evidence"]);
  }
  if (process.env.EVIDENCE_MODE === "uncommitted-only") {
    await writeFile("README.md", "unstaged change\\n");
    await writeFile("staged.txt", "staged change\\n");
    execFileSync("git", ["add", "staged.txt"]);
  }
  if (process.env.EVIDENCE_MODE === "mixed") {
    await writeFile("committed.txt", "committed and uncommitted change\\n");
  }
  if (process.env.EVIDENCE_MODE === "untracked") {
    await writeFile("untracked.txt", "untracked change\\n");
  }
  if (process.env.EVIDENCE_MODE === "capture-failure") {
    await rm(".git", { recursive: true });
  }
} else {
  await writeFile("implementation.txt", "changed\\n");
  await writeFile("result.txt", "artifact\\n");
}
if (process.env.FAKE_TIMEOUT_READY) await writeFile(process.env.FAKE_TIMEOUT_READY, "ready\\n");
console.log("fake pi stdout", JSON.stringify({
  home: process.env.HOME,
  agentDirectory: process.env.PI_CODING_AGENT_DIR,
  authCopied: existsSync(join(process.env.PI_CODING_AGENT_DIR, "auth.json")),
}));
console.error("fake pi stderr");
if (process.env.FAKE_TIMEOUT === "1") await new Promise((resolve) => setTimeout(resolve, 10_000));
if (process.env.FAKE_FAILURE === "1") process.exitCode = 7;
`);
}

test("retained diff covers committed, uncommitted, mixed, untracked, and no-change runs", async () => {
  const cases = [
    {
      mode: "committed-only",
      changedFiles: [],
      commits: ["committed evidence"],
      evidence: [/committed change/],
    },
    {
      mode: "uncommitted-only",
      changedFiles: ["README.md", "staged.txt"],
      commits: [],
      evidence: [/unstaged change/, /staged change/],
    },
    {
      mode: "mixed",
      changedFiles: ["committed.txt"],
      commits: ["committed evidence"],
      evidence: [/committed and uncommitted change/],
    },
    {
      mode: "untracked",
      changedFiles: ["untracked.txt"],
      commits: [],
      evidence: [/untracked change/],
    },
    { mode: "no-change", changedFiles: [], commits: [], evidence: [] },
  ];

  for (const fixture of cases) {
    const directory = await mkdtemp(join(tmpdir(), `pac-eval-${fixture.mode}-`));
    const repository = join(directory, "source");
    await initializeRepository(repository);
    const fakePi = join(directory, "fake-pi.mjs");
    await writeFakePi(fakePi);
    const manifest = validManifest(repository, join(directory, "eval-output"));
    manifest.profiles = [manifest.profiles[0]];
    manifest.scenarios[0].artifacts = [];
    manifest.scenarios[0].verify = [];

    const [result] = await runEvaluation(manifest, {
      piCommand: { command: process.execPath, leadingArgs: [fakePi] },
      environment: { EVIDENCE_MODE: fixture.mode },
    });
    const diff = await readFile(join(manifest.outputDirectory, result.git.diffPath), "utf8");

    assert.equal(result.status, "passed", fixture.mode);
    assert.deepEqual(result.git.changedFiles, fixture.changedFiles, fixture.mode);
    assert.deepEqual(result.git.commits.map(({ subject }) => subject), fixture.commits, fixture.mode);
    for (const pattern of fixture.evidence) assert.match(diff, pattern, fixture.mode);
    if (fixture.evidence.length === 0) assert.equal(diff, "", fixture.mode);
    await assert.rejects(access(join(manifest.outputDirectory, "runs", "narrow-change", "control", "repository")));
  }
});

test("Git evidence capture failures produce a runner error instead of an empty diff", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pac-eval-capture-failure-"));
  const repository = join(directory, "source");
  await initializeRepository(repository);
  const fakePi = join(directory, "fake-pi.mjs");
  await writeFakePi(fakePi);
  const manifest = validManifest(repository, join(directory, "eval-output"));
  manifest.profiles = [manifest.profiles[0]];
  manifest.scenarios[0].artifacts = [];
  manifest.scenarios[0].verify = [];

  const [result] = await runEvaluation(manifest, {
    piCommand: { command: process.execPath, leadingArgs: [fakePi] },
    environment: { EVIDENCE_MODE: "capture-failure" },
  });

  assert.equal(result.status, "runner_error");
  assert.match(result.error, /cannot capture Git status/);
  assert.match(
    await readFile(join(manifest.outputDirectory, result.paths.stderr), "utf8"),
    /cannot capture Git status/,
  );
  await assert.rejects(access(join(manifest.outputDirectory, result.git.diffPath)));
});

test("execution isolates the checkout, verifies externally, and retains normalized evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pac-eval-run-"));
  const repository = join(directory, "source");
  const baseSha = await initializeRepository(repository);
  const fakePi = join(directory, "fake-pi.mjs");
  await writeFakePi(fakePi);
  const agentDirectory = join(directory, "maintainer-agent");
  await mkdir(agentDirectory);
  await writeFile(join(agentDirectory, "auth.json"), "{}\n");
  const manifest = validManifest(repository, join(directory, "eval-output"));
  manifest.profiles = [manifest.profiles[0]];
  manifest.scenarios[0].verify = [{
    command: process.execPath,
    args: ["-e", "require('node:fs').accessSync('implementation.txt')"],
    timeoutMs: 1000,
  }];

  const results = await runEvaluation(manifest, {
    piCommand: { command: process.execPath, leadingArgs: [fakePi] },
    agentDirectory,
  });
  const result = results[0];

  assert.equal(result.status, "passed");
  assert.equal(result.piVersion, "0.85.0");
  assert.equal(PINNED_PI_VERSION, "0.85.0");
  assert.equal(result.repository.baseSha, baseSha);
  assert.deepEqual(result.executionPolicy, {
    tools: ["read", "edit", "write", "grep", "find", "ls"],
    packageResources: {},
  });
  assert.deepEqual(result.actualConfiguration, {
    provider: "openai-codex",
    model: "gpt-5.4",
    thinking: "medium",
  });
  assert.equal(result.configurationMatched, true);
  assert.deepEqual(result.telemetry.actualConfiguration, result.actualConfiguration);
  assert.equal(result.telemetry.messages, 2);
  assert.equal(result.telemetry.assistantTurns, 1);
  assert.deepEqual(result.telemetry.tokens, { input: 10, output: 5, cacheRead: 3, cacheWrite: 2, total: 20 });
  assert.deepEqual(result.telemetry.cost, { reported: 0.2, estimated: null, total: 0.2, currency: "USD" });
  assert.deepEqual(result.telemetry.context, { samples: [15], initial: 15, peak: 15, final: 15, max: 100 });
  assert.deepEqual(result.git.changedFiles, ["implementation.txt", "result.txt"]);
  assert.match(await readFile(join(manifest.outputDirectory, result.git.diffPath), "utf8"), /changed/);
  assert.equal(result.verification[0].status, "passed");
  const stdout = await readFile(join(manifest.outputDirectory, result.paths.stdout), "utf8");
  assert.match(stdout, /fake pi stdout/);
  assert.match(stdout, /"authCopied":true/);
  assert.doesNotMatch(stdout, new RegExp(`"home":"${process.env.HOME}"`));
  assert.match(await readFile(join(manifest.outputDirectory, result.paths.stderr), "utf8"), /fake pi stderr/);
  assert.equal(await readFile(join(manifest.outputDirectory, result.artifacts[0]), "utf8"), "artifact\n");
  const canonicalPath = join(manifest.outputDirectory, "results.json");
  const reportPath = join(manifest.outputDirectory, "report.html");
  const canonical = JSON.parse(await readFile(canonicalPath, "utf8"));
  assert.equal(canonical.schemaVersion, 1);
  assert.deepEqual(canonical.matrix.runs, [{ scenarioId: "narrow-change", profileId: "control" }]);
  assert.equal(canonical.runs[0].status, "passed");
  assert.equal(canonical.runs[0].telemetry.sessions[0].cwd, ".");
  for (const reference of canonical.runs[0].retainedArtifacts) {
    await access(join(manifest.outputDirectory, reference.path));
  }
  assert.match(await readFile(reportPath, "utf8"), /narrow-change/);

  const regeneratedPath = join(manifest.outputDirectory, "report-regenerated.html");
  await execFileAsync(process.execPath, [
    "--experimental-strip-types", "scripts/pac-eval.ts", "--report", canonicalPath, regeneratedPath,
  ], { cwd: process.cwd() });
  assert.equal(await readFile(regeneratedPath, "utf8"), await readFile(reportPath, "utf8"));
  await assert.rejects(access(join(repository, "implementation.txt")));
  const retainedRunDirectory = join(manifest.outputDirectory, "runs", "narrow-change", "control");
  await assert.rejects(access(join(retainedRunDirectory, "repository")));
  await assert.rejects(access(join(retainedRunDirectory, "home")));
  await assert.rejects(access(join(retainedRunDirectory, "agent-config")));
});

test("failed, timed-out, mismatched, and verification-failed children retain normalized results", async (context) => {
  const cases = [
    { name: "failure", environment: { FAKE_FAILURE: "1" }, expected: "child_failed" },
    { name: "timeout", environment: { FAKE_TIMEOUT: "1" }, expected: "timed_out", timeoutMs: 50 },
    { name: "mismatch", environment: { FAKE_MISMATCH: "1" }, expected: "configuration_mismatch" },
    { name: "verification", expected: "verification_failed", verificationFails: true },
  ];

  for (const fixture of cases) {
    const directory = await mkdtemp(join(tmpdir(), `pac-eval-${fixture.name}-`));
    const repository = join(directory, "source");
    await initializeRepository(repository);
    const fakePi = join(directory, "fake-pi.mjs");
    await writeFakePi(fakePi);
    const manifest = validManifest(repository, join(directory, "eval-output"));
    manifest.profiles = [manifest.profiles[0]];
    manifest.scenarios[0].timeoutMs = fixture.timeoutMs ?? 1000;
    manifest.scenarios[0].verify = fixture.verificationFails
      ? [{ command: process.execPath, args: ["-e", "process.exit(3)"], timeoutMs: 1000 }]
      : [];

    const timeoutReady = fixture.name === "timeout" ? join(directory, "timeout-ready") : undefined;
    const readyWatcher = timeoutReady ? watch(directory) : undefined;
    if (timeoutReady) context.mock.timers.enable({ apis: ["setTimeout"] });
    const evaluation = runEvaluation(manifest, {
      piCommand: { command: process.execPath, leadingArgs: [fakePi] },
      environment: { ...fixture.environment, FAKE_TIMEOUT_READY: timeoutReady },
    });
    if (timeoutReady && readyWatcher) {
      for await (const _event of readyWatcher) {
        try {
          await access(timeoutReady);
          break;
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
      await readyWatcher.return();
      context.mock.timers.tick(fixture.timeoutMs);
    }
    const [result] = await evaluation;
    if (timeoutReady) context.mock.timers.reset();

    assert.equal(result.status, fixture.expected, fixture.name);
    assert.equal(JSON.parse(await readFile(join(manifest.outputDirectory, result.paths.result), "utf8")).status, fixture.expected);
    assert.equal(result.telemetry.messages, 2, `${fixture.name} should retain partial session telemetry`);
    assert.deepEqual(result.telemetry.actualConfiguration, {
      provider: "openai-codex",
      model: fixture.name === "mismatch" ? "different-model" : "gpt-5.4",
      thinking: "medium",
    });
    assert.equal(typeof await readFile(join(manifest.outputDirectory, result.paths.stdout), "utf8"), "string");
    if (result.artifacts[0]) {
      assert.equal(await readFile(join(manifest.outputDirectory, result.artifacts[0]), "utf8"), "artifact\n");
    }
  }
});
