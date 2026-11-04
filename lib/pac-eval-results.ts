import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import type { EvalManifest, EvalProfile, EvalScenario, RunResult } from "../scripts/pac-eval.ts";

export const EVALUATION_RESULT_SCHEMA_VERSION = 1 as const;

export interface ArtifactReference {
  kind: "artifact" | "commits" | "diff" | "result" | "sessions" | "stderr" | "stdout";
  path: string;
}

export interface CanonicalRunResult extends Omit<RunResult, "schemaVersion" | "artifacts" | "paths" | "git" | "telemetry"> {
  telemetry: RunResult["telemetry"];
  availability: {
    telemetryComplete: boolean;
    pricing: "reported" | "estimated" | "mixed" | "unknown";
  };
  git: RunResult["git"] & { commits: Array<{ sha: string; subject: string }> };
  retainedArtifacts: ArtifactReference[];
  warnings: string[];
}

export interface CanonicalEvaluationResult {
  $schema: "https://github.com/ladislas/mypac/schemas/pac-eval-result.schema.json";
  schemaVersion: typeof EVALUATION_RESULT_SCHEMA_VERSION;
  evaluation: { id: string; piVersion: string; startedAt: string; finishedAt: string; durationMs: number };
  repository: { source: string; ref: string; sha: string };
  matrix: {
    scenarios: EvalScenario[];
    profiles: Array<EvalProfile & { resolvedPackageSha: string | null }>;
    runs: Array<{ scenarioId: string; profileId: string }>;
  };
  runs: CanonicalRunResult[];
  humanReview: {
    dimensions: string[];
    persistence: "external";
  };
  warnings: Array<{ scenarioId: string; profileId: string; message: string }>;
}

const HUMAN_REVIEW_DIMENSIONS = [
  "correctness",
  "scope discipline",
  "implementation simplicity/quality",
  "test quality",
  "unnecessary tool/context usage",
  "autonomy",
  "Git hygiene",
  "overall preference/notes",
];

function safeArtifactPath(path: string): boolean {
  return path.length > 0 && !isAbsolute(path) && !path.split(/[\\/]/).includes("..");
}

function retainedArtifacts(run: RunResult): ArtifactReference[] {
  const references: ArtifactReference[] = [
    ...run.artifacts.map((path) => ({ kind: "artifact" as const, path })),
    { kind: "commits", path: run.git.commitsPath },
    { kind: "diff", path: run.git.diffPath },
    { kind: "result", path: run.paths.result },
    { kind: "sessions", path: run.paths.sessionDirectory },
    { kind: "stderr", path: run.paths.stderr },
    { kind: "stdout", path: run.paths.stdout },
  ];
  return references.filter(({ path }) => safeArtifactPath(path)).sort((left, right) => left.path.localeCompare(right.path));
}

// Older result files used "reported" for costs without provider provenance.
function normalizeCost(cost: RunResult["telemetry"]["cost"]): RunResult["telemetry"]["cost"] {
  if (cost.unknown !== undefined) return cost;
  return { ...cost, reported: null, unknown: cost.reported };
}

function pricingAvailability(cost: RunResult["telemetry"]["cost"]): CanonicalRunResult["availability"]["pricing"] {
  const sources = [cost.reported, cost.estimated, cost.unknown].filter((value) => value != null).length;
  if (sources > 1) return "mixed";
  if (cost.reported !== null) return "reported";
  if (cost.estimated !== null) return "estimated";
  return "unknown";
}

function runWarnings(run: RunResult, scenario: EvalScenario): string[] {
  const warnings: string[] = [];
  if (run.status !== "passed") warnings.push(`Run outcome: ${run.status}.`);
  if (!run.configurationMatched) warnings.push("Actual model/thinking configuration did not match the request or was unavailable.");
  if (run.telemetry.sessions.length === 0) warnings.push("Session telemetry is unavailable.");
  else if (run.telemetry.malformedLines > 0 || Object.values(run.telemetry.tokens).some((value) => value === null)) {
    warnings.push("Session telemetry is incomplete.");
  }
  if (run.telemetry.cost.total === null) warnings.push("Pricing is unavailable; cost is unknown.");
  if (run.telemetry.malformedLines > 0) warnings.push(`${run.telemetry.malformedLines} malformed session line(s) were skipped.`);
  if (run.error) warnings.push(`Runner error: ${run.error}`);
  for (const expected of scenario.artifacts ?? []) {
    if (!run.artifacts.some((path) => path.endsWith(`/artifacts/${expected}`))) warnings.push(`Requested artifact was not retained: ${expected}`);
  }
  return warnings;
}

function runOrder(manifest: EvalManifest): Map<string, number> {
  return new Map(manifest.scenarios.flatMap((scenario, scenarioIndex) =>
    manifest.profiles.map((profile, profileIndex) => [
      `${scenario.id}\0${profile.id}`,
      scenarioIndex * manifest.profiles.length + profileIndex,
    ] as const),
  ));
}

export function buildCanonicalEvaluationResult(manifest: EvalManifest, inputRuns: RunResult[]): CanonicalEvaluationResult {
  if (inputRuns.length === 0) throw new Error("Cannot build an evaluation result without runs");
  const order = runOrder(manifest);
  const sortedRuns = [...inputRuns].sort((left, right) =>
    (order.get(`${left.scenarioId}\0${left.profileId}`) ?? Number.MAX_SAFE_INTEGER)
      - (order.get(`${right.scenarioId}\0${right.profileId}`) ?? Number.MAX_SAFE_INTEGER),
  );
  const scenarioById = new Map(manifest.scenarios.map((scenario) => [scenario.id, scenario]));
  const canonicalRuns: CanonicalRunResult[] = sortedRuns.map((run) => {
    const scenario = scenarioById.get(run.scenarioId);
    if (!scenario) throw new Error(`Run refers to unknown scenario ${run.scenarioId}`);
    const telemetryComplete = run.telemetry.sessions.length > 0
      && run.telemetry.malformedLines === 0
      && !Object.values(run.telemetry.tokens).some((value) => value === null);
    const telemetry = {
      ...run.telemetry,
      cost: normalizeCost(run.telemetry.cost),
      sessions: run.telemetry.sessions.map((session) => ({ ...session, cwd: session.cwd === null ? null : "." })),
    };
    const git = {
      ...run.git,
      commits: "commits" in run.git && Array.isArray(run.git.commits)
        ? run.git.commits as Array<{ sha: string; subject: string }>
        : [],
    };
    const { schemaVersion: _schemaVersion, artifacts: _artifacts, paths: _paths, ...rest } = run;
    return {
      ...rest,
      telemetry,
      availability: { telemetryComplete, pricing: pricingAvailability(telemetry.cost) },
      git,
      retainedArtifacts: retainedArtifacts(run),
      warnings: runWarnings(run, scenario),
    };
  });
  const timestamps = canonicalRuns.flatMap((run) => [Date.parse(run.startedAt), Date.parse(run.finishedAt)]).filter(Number.isFinite);
  const startedMs = Math.min(...timestamps);
  const finishedMs = Math.max(...timestamps);
  const firstRun = canonicalRuns[0];
  const resolvedPackageSha = new Map(canonicalRuns.map((run) => [run.profileId, run.package?.sha ?? null]));
  return {
    $schema: "https://github.com/ladislas/mypac/schemas/pac-eval-result.schema.json",
    schemaVersion: EVALUATION_RESULT_SCHEMA_VERSION,
    evaluation: {
      id: manifest.id,
      piVersion: firstRun.piVersion,
      startedAt: new Date(startedMs).toISOString(),
      finishedAt: new Date(finishedMs).toISOString(),
      durationMs: finishedMs - startedMs,
    },
    repository: {
      source: firstRun.repository.source,
      ref: firstRun.repository.ref,
      sha: firstRun.repository.baseSha,
    },
    matrix: {
      scenarios: manifest.scenarios,
      profiles: manifest.profiles.map((profile) => ({ ...profile, resolvedPackageSha: resolvedPackageSha.get(profile.id) ?? null })),
      runs: manifest.scenarios.flatMap((scenario) => manifest.profiles.map((profile) => ({ scenarioId: scenario.id, profileId: profile.id }))),
    },
    runs: canonicalRuns,
    humanReview: { dimensions: [...HUMAN_REVIEW_DIMENSIONS], persistence: "external" },
    warnings: canonicalRuns.flatMap((run) => run.warnings.map((message) => ({ scenarioId: run.scenarioId, profileId: run.profileId, message }))),
  };
}

export function serializeCanonicalEvaluationResult(result: CanonicalEvaluationResult): string {
  if (result.schemaVersion !== EVALUATION_RESULT_SCHEMA_VERSION) {
    throw new Error(`Unsupported evaluation result schema version: ${result.schemaVersion}`);
  }
  return `${JSON.stringify(result, null, 2)}\n`;
}

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

function formatNumber(value: number | null | undefined): string {
  return value == null ? "Unknown" : new Intl.NumberFormat("en-US").format(value);
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}

function formatCost(run: CanonicalRunResult): string {
  const cost = normalizeCost(run.telemetry.cost);
  if (cost.total === null) return "Unknown pricing";
  const qualifier = [
    cost.reported !== null ? "provider-reported" : null,
    cost.estimated !== null ? "estimated" : null,
    cost.unknown != null ? "unknown provenance" : null,
  ].filter(Boolean).join(" + ") || "unknown provenance";
  return `$${cost.total.toFixed(4)} ${cost.currency} (${qualifier})`;
}

function artifactHref(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function runCard(run: CanonicalRunResult): string {
  const actual = run.actualConfiguration
    ? `${run.actualConfiguration.provider}/${run.actualConfiguration.model} · ${run.actualConfiguration.thinking}`
    : "Unknown";
  const warnings = run.warnings.length === 0 ? "" : `<div class="warnings"><strong>Warnings</strong><ul>${run.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></div>`;
  const verification = run.verification.length === 0 ? "Not configured" : run.verification.map((item) => `${item.status}: ${item.command.join(" ")}`).join("; ");
  const commits = run.git.commits.length === 0 ? "None" : `<ul>${run.git.commits.map((commit) => `<li><code>${escapeHtml(commit.sha)}</code> ${escapeHtml(commit.subject)}</li>`).join("")}</ul>`;
  const artifacts = run.retainedArtifacts.length === 0 ? "None" : `<ul>${run.retainedArtifacts.map((artifact) => `<li>${escapeHtml(artifact.kind)}: <a href="${escapeHtml(artifactHref(artifact.path))}">${escapeHtml(artifact.path)}</a></li>`).join("")}</ul>`;
  return `<article class="run-card">
    <header><h3>${escapeHtml(run.profileId)}</h3><span class="status status-${escapeHtml(run.status)}">${escapeHtml(run.status)}</span></header>
    <dl>
      <dt>Requested model / thinking</dt><dd>${escapeHtml(run.requestedConfiguration.model)} · ${escapeHtml(run.requestedConfiguration.thinking)}</dd>
      <dt>Actual model / thinking</dt><dd>${escapeHtml(actual)}</dd>
      <dt>Verification state</dt><dd>${escapeHtml(verification)}</dd>
      <dt>Input tokens</dt><dd>${formatNumber(run.telemetry.tokens.input)}</dd>
      <dt>Output tokens</dt><dd>${formatNumber(run.telemetry.tokens.output)}</dd>
      <dt>Cache tokens</dt><dd>read ${formatNumber(run.telemetry.tokens.cacheRead)} · write ${formatNumber(run.telemetry.tokens.cacheWrite)}</dd>
      <dt>Total tokens</dt><dd>${formatNumber(run.telemetry.tokens.total)}</dd>
      <dt>Context initial / peak / final / max</dt><dd>${formatNumber(run.telemetry.context.initial)} / ${formatNumber(run.telemetry.context.peak)} / ${formatNumber(run.telemetry.context.final)} / ${formatNumber(run.telemetry.context.max)}</dd>
      <dt>API-equivalent cost</dt><dd>${escapeHtml(formatCost(run))}</dd>
      <dt>Child duration</dt><dd>${escapeHtml(formatDuration(run.child.durationMs))}</dd>
      <dt>Changed files</dt><dd>${run.git.changedFiles.length ? run.git.changedFiles.map(escapeHtml).join("<br>") : "None"}</dd>
    </dl>
    <p class="muted">API-equivalent token value where pricing is known; not subscription charges or an invoice. Unpriced provider and historical amounts are retained, not verified API-equivalent values.</p>
    ${warnings}
    <details><summary>Evidence and retained artifacts</summary><h4>Resulting commits</h4>${commits}<h4>Artifacts</h4>${artifacts}${run.error ? `<h4>Runner error</h4><pre>${escapeHtml(run.error)}</pre>` : ""}</details>
    <details><summary>Human review</summary><div class="review-grid">${HUMAN_REVIEW_DIMENSIONS.map((dimension) => `<label>${escapeHtml(dimension)}<textarea aria-label="${escapeHtml(`${run.scenarioId} ${run.profileId} ${dimension}`)}"></textarea></label>`).join("")}</div><p class="muted">Review entries are placeholders and are not persisted by this static report.</p></details>
  </article>`;
}

export function renderEvaluationReport(result: CanonicalEvaluationResult): string {
  if (result.schemaVersion !== EVALUATION_RESULT_SCHEMA_VERSION) throw new Error(`Unsupported evaluation result schema version: ${result.schemaVersion}`);
  const scenarioSections = result.matrix.scenarios.map((scenario) => {
    const runs = result.runs.filter((run) => run.scenarioId === scenario.id);
    return `<section><h2>${escapeHtml(scenario.id)}</h2><p>${escapeHtml(scenario.prompt)}</p><div class="comparison">${runs.map(runCard).join("\n")}</div></section>`;
  }).join("\n");
  const matrixRuns = result.matrix.runs.map((run) => `<li>${escapeHtml(run.scenarioId)} × ${escapeHtml(run.profileId)}</li>`).join("");
  const matrixScenarios = result.matrix.scenarios.map((scenario) => `<li><strong>${escapeHtml(scenario.id)}</strong> · timeout ${scenario.timeoutMs === undefined ? "default" : escapeHtml(formatDuration(scenario.timeoutMs))} · verification ${scenario.verify?.length ?? 0} · requested artifacts ${scenario.artifacts?.length ?? 0}</li>`).join("");
  const matrixProfiles = result.matrix.profiles.map((profile) => {
    const packageRef = profile.package
      ? `${profile.package.path} @ ${profile.package.ref} (${profile.resolvedPackageSha ?? "unresolved"})`
      : "none";
    return `<li><strong>${escapeHtml(profile.id)}</strong> · ${escapeHtml(profile.model)} · ${escapeHtml(profile.thinking)} · workflow ${escapeHtml(profile.workflow ?? "none")} · tools ${escapeHtml((profile.execution?.tools ?? []).join(", ") || "runner defaults")} · package ${escapeHtml(packageRef)}</li>`;
  }).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(result.evaluation.id)} evaluation comparison</title>
<style>
:root{color-scheme:light dark;font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.45;--panel:#f5f5f5;--border:#bbb;--warning:#7a3e00}body{max-width:1500px;margin:auto;padding:2rem}header.meta{border-bottom:2px solid var(--border);margin-bottom:2rem}.comparison{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1rem}.run-card{border:1px solid var(--border);border-radius:8px;padding:1rem;background:var(--panel);min-width:0}.run-card header{display:flex;align-items:center;justify-content:space-between;gap:1rem}.run-card h3{margin:0}.status{font-weight:700;padding:.2rem .5rem;border-radius:1rem;border:1px solid}.status-passed{color:#176b32}.status-timed_out,.status-child_failed,.status-runner_error,.status-verification_failed,.status-configuration_mismatch{color:#9b1c1c}dl{display:grid;grid-template-columns:minmax(9rem,1fr) 2fr;gap:.35rem 1rem}dt{font-weight:700}dd{margin:0;overflow-wrap:anywhere}.warnings{color:var(--warning)}details{margin-top:1rem}summary{cursor:pointer;font-weight:700}.review-grid{display:grid;gap:.6rem;margin-top:.6rem}.review-grid label{display:grid;font-weight:600}.review-grid textarea{min-height:3rem}.muted{opacity:.7;font-size:.9rem}code,pre{overflow-wrap:anywhere;white-space:pre-wrap}@media(prefers-color-scheme:dark){:root{--panel:#20242a;--border:#666;--warning:#ffc078}}@media print{body{max-width:none}.comparison{grid-template-columns:repeat(2,1fr)}details{display:block}summary{display:none}}
</style></head><body>
<header class="meta"><h1>${escapeHtml(result.evaluation.id)}</h1><p>Schema v${result.schemaVersion} · Pi ${escapeHtml(result.evaluation.piVersion)} · ${escapeHtml(result.evaluation.startedAt)}–${escapeHtml(result.evaluation.finishedAt)} · ${escapeHtml(formatDuration(result.evaluation.durationMs))}</p><p><strong>Repository:</strong> ${escapeHtml(result.repository.source)} @ ${escapeHtml(result.repository.ref)} (<code>${escapeHtml(result.repository.sha)}</code>)</p><details><summary>Exact evaluation matrix (${result.matrix.runs.length} runs)</summary><h3>Scenarios</h3><ul>${matrixScenarios}</ul><h3>Profiles</h3><ul>${matrixProfiles}</ul><h3>Expanded runs</h3><ol>${matrixRuns}</ol></details></header>
<main>${scenarioSections}</main>
<footer><p>Generated only from <code>results.json</code>. No child session or network access is required.</p></footer></body></html>\n`;
}

export async function writeEvaluationOutputs(outputDirectory: string, result: CanonicalEvaluationResult): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, "results.json"), serializeCanonicalEvaluationResult(result));
  await writeFile(join(outputDirectory, "report.html"), renderEvaluationReport(result));
}

export async function regenerateEvaluationReport(resultsPath: string, outputPath?: string): Promise<string> {
  const parsed = JSON.parse(await readFile(resultsPath, "utf8")) as CanonicalEvaluationResult;
  const html = renderEvaluationReport(parsed);
  await writeFile(outputPath ?? join(resultsPath, "..", "report.html"), html);
  return html;
}
