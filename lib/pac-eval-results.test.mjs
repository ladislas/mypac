import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildCanonicalEvaluationResult,
  regenerateEvaluationReport,
  renderEvaluationReport,
  serializeCanonicalEvaluationResult,
  writeEvaluationOutputs,
} from "./pac-eval-results.ts";

const telemetry = {
  sessions: [{ file: "session.jsonl", id: "session-1", startedAt: "2026-01-01T00:00:00.000Z", cwd: "/temporary/checkout" }],
  messages: 2,
  assistantTurns: 1,
  tokens: { input: 10, output: 5, cacheRead: 3, cacheWrite: 2, total: 20 },
  cost: { reported: 0.2, estimated: null, unknown: null, total: 0.2, currency: "USD" },
  context: { samples: [15], initial: 15, peak: 15, final: 15, max: 100 },
  modelsUsed: ["openai-codex/gpt-5.4"],
  thinkingLevelsUsed: ["medium"],
  actualConfiguration: { provider: "openai-codex", model: "gpt-5.4", thinking: "medium" },
  malformedLines: 0,
};

function run(profileId, overrides = {}) {
  return {
    schemaVersion: 1,
    evaluationId: "comparison",
    scenarioId: "change",
    profileId,
    status: "passed",
    piVersion: "0.84.3",
    requestedConfiguration: { model: "openai-codex/gpt-5.4", thinking: profileId === "control" ? "medium" : "high" },
    executionPolicy: { tools: ["read", "edit", "write"], packageResources: {} },
    package: null,
    actualConfiguration: { provider: "openai-codex", model: "gpt-5.4", thinking: profileId === "control" ? "medium" : "high" },
    configurationMatched: true,
    telemetry: { ...telemetry, actualConfiguration: { provider: "openai-codex", model: "gpt-5.4", thinking: profileId === "control" ? "medium" : "high" } },
    repository: { source: "/source/repository", ref: "main", baseSha: "abc123" },
    child: { exitCode: 0, signal: null, timedOut: false, durationMs: profileId === "control" ? 1000 : 1200 },
    verification: [{ command: ["npm", "test"], status: "passed", exitCode: 0, durationMs: 100 }],
    git: {
      status: " M lib/change.ts\n",
      changedFiles: ["lib/change.ts"],
      diffPath: `runs/change/${profileId}/diff.patch`,
      commitsPath: `runs/change/${profileId}/commits.txt`,
      commits: [{ sha: `${profileId}-sha`, subject: "Implement change" }],
    },
    artifacts: [`runs/change/${profileId}/artifacts/result.txt`],
    paths: {
      stdout: `runs/change/${profileId}/stdout.log`,
      stderr: `runs/change/${profileId}/stderr.log`,
      sessionDirectory: `runs/change/${profileId}/session`,
      result: `runs/change/${profileId}/result.json`,
    },
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: profileId === "control" ? "2026-01-01T00:00:01.000Z" : "2026-01-01T00:00:02.200Z",
    ...overrides,
  };
}

function manifest(outputDirectory) {
  return {
    version: 1,
    id: "comparison",
    outputDirectory,
    repository: { path: "/source/repository", ref: "main" },
    profiles: [
      { id: "control", model: "openai-codex/gpt-5.4", thinking: "medium" },
      { id: "candidate", model: "openai-codex/gpt-5.4", thinking: "high", workflow: "/pac-lwot" },
    ],
    scenarios: [{
      id: "change",
      prompt: "Implement the requested change.",
      timeoutMs: 10_000,
      verify: [{ command: "npm", args: ["test"], timeoutMs: 5_000 }],
      artifacts: ["result.txt"],
    }],
  };
}

test("canonical result deterministically records a normal multi-profile comparison", () => {
  const result = buildCanonicalEvaluationResult(manifest("/output"), [run("candidate"), run("control")]);

  assert.equal(result.schemaVersion, 1);
  assert.deepEqual(result.evaluation, {
    id: "comparison",
    piVersion: "0.84.3",
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:00:02.200Z",
    durationMs: 2200,
  });
  assert.deepEqual(result.repository, { source: "/source/repository", ref: "main", sha: "abc123" });
  assert.deepEqual(result.matrix.runs, [
    { scenarioId: "change", profileId: "control" },
    { scenarioId: "change", profileId: "candidate" },
  ]);
  assert.deepEqual(result.runs.map(({ profileId }) => profileId), ["control", "candidate"]);
  assert.equal(result.runs[0].telemetry.sessions[0].cwd, ".");
  assert.deepEqual(result.runs[0].git.commits, [{ sha: "control-sha", subject: "Implement change" }]);
  assert.deepEqual(result.runs[0].retainedArtifacts.map(({ path }) => path), [
    "runs/change/control/artifacts/result.txt",
    "runs/change/control/commits.txt",
    "runs/change/control/diff.patch",
    "runs/change/control/result.json",
    "runs/change/control/session",
    "runs/change/control/stderr.log",
    "runs/change/control/stdout.log",
  ]);
  assert.equal(serializeCanonicalEvaluationResult(result), serializeCanonicalEvaluationResult(result));
});

test("failed, timed-out, mismatched, runner-error, and incomplete runs preserve evidence and warnings", () => {
  const cases = [
    { status: "child_failed", child: { exitCode: 7, signal: null, timedOut: false, durationMs: 500 } },
    { status: "timed_out", child: { exitCode: null, signal: "SIGTERM", timedOut: true, durationMs: 10_000 } },
    { status: "configuration_mismatch", configurationMatched: false, actualConfiguration: { provider: "other", model: "model", thinking: "low" } },
    { status: "runner_error", error: "checkout failed <output>" },
  ];

  for (const fixture of cases) {
    const canonical = buildCanonicalEvaluationResult(manifest("/output"), [run("control", fixture)]);
    assert.equal(canonical.runs[0].status, fixture.status);
    assert.ok(canonical.runs[0].warnings.length > 0);
    assert.equal(canonical.runs[0].git.changedFiles[0], "lib/change.ts");
    assert.equal(canonical.runs[0].retainedArtifacts.some(({ path }) => path.endsWith("diff.patch")), true);
  }

  const incomplete = run("control", {
    telemetry: {
      ...telemetry,
      sessions: [],
      tokens: { input: null, output: null, cacheRead: null, cacheWrite: null, total: null },
      cost: { reported: null, estimated: null, total: null, currency: "USD" },
      context: { samples: [], initial: null, peak: null, final: null, max: null },
      actualConfiguration: { provider: null, model: null, thinking: null },
    },
    actualConfiguration: null,
    configurationMatched: false,
  });
  const canonical = buildCanonicalEvaluationResult(manifest("/output"), [incomplete]);
  assert.equal(canonical.runs[0].availability.telemetryComplete, false);
  assert.equal(canonical.runs[0].availability.pricing, "unknown");
  assert.match(canonical.runs[0].warnings.join(" "), /telemetry is unavailable/i);
  assert.match(renderEvaluationReport(canonical), /Unknown pricing/);
  assert.doesNotMatch(renderEvaluationReport(canonical), /\$0\.0000/);
});

test("reports mixed and legacy cost provenance without implying provider billing", () => {
  for (const [cost, pricing, label] of [
    [{ reported: 2, estimated: 3, unknown: 4, total: 9, currency: "USD" }, "mixed", "provider-reported + estimated + unknown provenance"],
    [{ reported: 0, estimated: null, unknown: null, total: 0, currency: "USD" }, "reported", "provider-reported"],
    [{ reported: 4, estimated: null, total: 4, currency: "USD" }, "unknown", "unknown provenance"],
  ]) {
    const result = buildCanonicalEvaluationResult(manifest("/output"), [run("control", { telemetry: { ...telemetry, cost } })]);
    assert.equal(result.runs[0].availability.pricing, pricing);
    assert.match(renderEvaluationReport(result), new RegExp(label.replaceAll("+", "\\+")));
    assert.equal(result.runs[0].telemetry.cost.total, cost.total);
  }
});

test("renders historical canonical files conservatively without rewriting their evidence", () => {
  const result = buildCanonicalEvaluationResult(manifest("/output"), [run("control")]);
  result.runs[0].telemetry.cost = { reported: 4, estimated: null, total: 4, currency: "USD" };
  result.runs[0].availability.pricing = "reported";
  const before = JSON.stringify(result);
  const html = renderEvaluationReport(result);
  assert.ok(html.includes("$4.0000 USD (unknown provenance)"));
  assert.equal(JSON.stringify(result), before);
});

test("report escapes evidence strings and keeps retained artifact references local", () => {
  const comparison = manifest("/output");
  comparison.scenarios[0].prompt = "Change <script>alert('scenario')</script>";
  const unsafeEvidence = run("control", {
    error: "failure </style><script>alert('output')</script>",
    git: {
      ...run("control").git,
      changedFiles: ["result<&>.txt"],
      commits: [{ sha: "abc<123", subject: "Fix <unsafe> & output" }],
    },
    artifacts: ["runs/change/control/artifacts/result & evidence.txt"],
  });
  const html = renderEvaluationReport(buildCanonicalEvaluationResult(comparison, [unsafeEvidence]));

  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert/);
  assert.match(html, /result&lt;&amp;&gt;\.txt/);
  assert.match(html, /href="runs\/change\/control\/artifacts\/result%20%26%20evidence\.txt"/);
  assert.doesNotMatch(html, /href="(?:https?:|\/|\.\.)/);
  for (const label of ["Requested model / thinking", "Verification state", "Total tokens", "Context initial / peak / final / max", "Changed files", "Resulting commits", "Human review"]) {
    assert.match(html, new RegExp(label));
  }
  assert.doesNotMatch(html, /session\.jsonl|fixture prompt/);
});

test("legacy schema-v1 results without initial/final context regenerate with unknown values", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pac-eval-legacy-report-"));
  const result = buildCanonicalEvaluationResult(manifest(directory), [run("control")]);
  delete result.runs[0].telemetry.context.initial;
  delete result.runs[0].telemetry.context.final;
  const resultsPath = join(directory, "results.json");
  const reportPath = join(directory, "report.html");
  await writeFile(resultsPath, JSON.stringify(result));

  const html = await regenerateEvaluationReport(resultsPath, reportPath);

  assert.match(html, /Context initial \/ peak \/ final \/ max<\/dt><dd>Unknown \/ 15 \/ Unknown \/ 100/);
  assert.doesNotMatch(html, /NaN|undefined/);
  assert.equal(await readFile(reportPath, "utf8"), html);

  const schema = JSON.parse(await readFile(new URL("../schemas/pac-eval-result.schema.json", import.meta.url), "utf8"));
  const required = schema.$defs.telemetry.properties.context.required;
  assert.doesNotMatch(required.join(" "), /initial|final/);
  assert.ok(schema.$defs.telemetry.properties.context.properties.initial);
  assert.ok(schema.$defs.telemetry.properties.context.properties.final);
});

test("report can be regenerated identically from canonical JSON without child sessions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pac-eval-report-"));
  const result = buildCanonicalEvaluationResult(manifest(directory), [run("control"), run("candidate")]);
  await writeEvaluationOutputs(directory, result);

  const canonical = JSON.parse(await readFile(join(directory, "results.json"), "utf8"));
  const firstHtml = await readFile(join(directory, "report.html"), "utf8");
  const regenerated = renderEvaluationReport(canonical);

  assert.equal(regenerated, firstHtml);
  assert.match(firstHtml, /control/);
  assert.match(firstHtml, /candidate/);
  assert.match(firstHtml, /Input tokens/);
  assert.match(firstHtml, /Human review/);
  assert.doesNotMatch(firstHtml, /fixture prompt/);
  await writeFile(join(directory, "report-regenerated.html"), regenerated);
});
