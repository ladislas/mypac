#!/usr/bin/env -S node --experimental-strip-types
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCanonicalEvaluationResult,
  regenerateEvaluationReport,
  writeEvaluationOutputs,
} from "../lib/pac-eval-results.ts";
import { parsePiSessionLines } from "../lib/pi-session-telemetry.ts";

const THINKING_LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
const BUILT_IN_TOOLS = new Set(["read", "bash", "powershell", "edit", "write", "grep", "find", "ls"]);
const DEFAULT_TOOLS = ["read", "edit", "write", "grep", "find", "ls"];
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

type JsonObject = Record<string, unknown>;

export interface PackageResources {
  prompts?: string[];
  skills?: string[];
  extensions?: string[];
}

export interface PackageConfig {
  path: string;
  ref: string;
  resources?: PackageResources;
}

export interface EvalProfile {
  id: string;
  model: string;
  thinking: string;
  workflow?: string;
  execution?: { tools: string[] };
  package?: PackageConfig;
}

export interface VerificationCommand {
  command: string;
  args?: string[];
  timeoutMs?: number;
}

export interface EvalScenario {
  id: string;
  prompt: string;
  timeoutMs?: number;
  verify?: VerificationCommand[];
  artifacts?: string[];
}

export interface EvalManifest {
  version: 1;
  id: string;
  outputDirectory: string;
  repository: { path: string; ref: string };
  profiles: EvalProfile[];
  scenarios: EvalScenario[];
}

export interface MatrixRun {
  scenario: EvalScenario;
  profile: EvalProfile;
}

export interface PiInvocation {
  command: string;
  args: string[];
}

export interface ProcessResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface RunSessionTelemetry {
  sessions: Array<{ file: string; id: string | null; startedAt: string | null; cwd: string | null }>;
  messages: number | null;
  assistantTurns: number | null;
  tokens: { input: number | null; output: number | null; cacheRead: number | null; cacheWrite: number | null; total: number | null };
  cost: { reported: number | null; estimated: number | null; total: number | null; currency: "USD" };
  context: { samples: number[]; initial: number | null; peak: number | null; final: number | null; max: number | null };
  modelsUsed: string[];
  thinkingLevelsUsed: string[];
  actualConfiguration: { provider: string | null; model: string | null; thinking: string | null };
  malformedLines: number;
}

export interface RunResult {
  schemaVersion: 1;
  evaluationId: string;
  scenarioId: string;
  profileId: string;
  status: "passed" | "child_failed" | "timed_out" | "configuration_mismatch" | "verification_failed" | "runner_error";
  piVersion: string;
  requestedConfiguration: { model: string; thinking: string };
  executionPolicy: { tools: string[]; packageResources: PackageResources };
  package: { source: string; ref: string; sha: string } | null;
  actualConfiguration: { provider: string; model: string; thinking: string } | null;
  configurationMatched: boolean;
  telemetry: RunSessionTelemetry;
  repository: { source: string; ref: string; baseSha: string };
  child: Omit<ProcessResult, "stdout" | "stderr">;
  verification: Array<{ command: string[]; status: "passed" | "failed" | "timed_out"; exitCode: number | null; durationMs: number }>;
  git: {
    status: string;
    changedFiles: string[];
    commits: Array<{ sha: string; subject: string }>;
    diffPath: string;
    commitsPath: string;
  };
  artifacts: string[];
  paths: { stdout: string; stderr: string; sessionDirectory: string; result: string };
  startedAt: string;
  finishedAt: string;
  error?: string;
}

export interface EvaluationDependencies {
  piCommand?: { command: string; leadingArgs?: string[] };
  environment?: NodeJS.ProcessEnv;
  agentDirectory?: string;
}

function object(value: unknown, path: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as JsonObject;
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${path} must be a non-empty string`);
  return value;
}

function id(value: unknown, path: string): string {
  const parsed = string(value, path);
  if (!ID_PATTERN.test(parsed)) throw new Error(`${path} must match ${ID_PATTERN}`);
  return parsed;
}

function optionalTimeout(value: unknown, path: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new Error(`${path} must be a positive integer`);
  return value as number;
}

function stringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value.map((item, index) => string(item, `${path}[${index}]`));
}

function safeRelativePaths(value: unknown, path: string): string[] {
  return stringArray(value, path).map((item, index) => {
    if (isAbsolute(item) || item.split(/[\\/]/).includes("..")) {
      throw new Error(`${path}[${index}] must stay inside the resolved package`);
    }
    return item;
  });
}

function packageResources(value: unknown, path: string): PackageResources {
  const parsed = object(value, path);
  return {
    prompts: parsed.prompts === undefined ? undefined : safeRelativePaths(parsed.prompts, `${path}.prompts`),
    skills: parsed.skills === undefined ? undefined : safeRelativePaths(parsed.skills, `${path}.skills`),
    extensions: parsed.extensions === undefined ? undefined : safeRelativePaths(parsed.extensions, `${path}.extensions`),
  };
}

function packageConfig(value: unknown, path: string): PackageConfig {
  const parsed = object(value, path);
  return {
    path: string(parsed.path, `${path}.path`),
    ref: string(parsed.ref, `${path}.ref`),
    resources: parsed.resources === undefined ? undefined : packageResources(parsed.resources, `${path}.resources`),
  };
}

function executionPolicy(value: unknown, path: string): { tools: string[] } {
  const parsed = object(value, path);
  const tools = stringArray(parsed.tools, `${path}.tools`);
  if (tools.length === 0) throw new Error(`${path}.tools must not be empty`);
  for (const tool of tools) {
    if (!BUILT_IN_TOOLS.has(tool)) throw new Error(`${path}.tools contains unsupported built-in tool ${tool}`);
  }
  if (new Set(tools).size !== tools.length) throw new Error(`${path}.tools must not contain duplicates`);
  return { tools };
}

function profile(value: unknown, index: number): EvalProfile {
  const path = `profiles[${index}]`;
  const parsed = object(value, path);
  const thinking = string(parsed.thinking, `${path}.thinking`);
  if (!THINKING_LEVELS.has(thinking)) throw new Error(`${path}.thinking is not supported by pinned Pi`);
  return {
    id: id(parsed.id, `${path}.id`),
    model: (() => {
      const model = string(parsed.model, `${path}.model`);
      if (!model.includes("/")) throw new Error(`${path}.model must use the exact provider/model form`);
      return model;
    })(),
    thinking,
    workflow: parsed.workflow === undefined ? undefined : string(parsed.workflow, `${path}.workflow`),
    execution: parsed.execution === undefined ? undefined : executionPolicy(parsed.execution, `${path}.execution`),
    package: parsed.package === undefined ? undefined : packageConfig(parsed.package, `${path}.package`),
  };
}

function verification(value: unknown, path: string): VerificationCommand {
  const parsed = object(value, path);
  return {
    command: string(parsed.command, `${path}.command`),
    args: parsed.args === undefined ? undefined : stringArray(parsed.args, `${path}.args`),
    timeoutMs: optionalTimeout(parsed.timeoutMs, `${path}.timeoutMs`),
  };
}

function scenario(value: unknown, index: number): EvalScenario {
  const path = `scenarios[${index}]`;
  const parsed = object(value, path);
  return {
    id: id(parsed.id, `${path}.id`),
    prompt: string(parsed.prompt, `${path}.prompt`),
    timeoutMs: optionalTimeout(parsed.timeoutMs, `${path}.timeoutMs`),
    verify: parsed.verify === undefined
      ? undefined
      : (Array.isArray(parsed.verify) ? parsed.verify : (() => { throw new Error(`${path}.verify must be an array`); })())
          .map((item, commandIndex) => verification(item, `${path}.verify[${commandIndex}]`)),
    artifacts: parsed.artifacts === undefined ? undefined : stringArray(parsed.artifacts, `${path}.artifacts`).map((artifact, artifactIndex) => {
      if (isAbsolute(artifact) || artifact.split(/[\\/]/).includes("..")) {
        throw new Error(`${path}.artifacts[${artifactIndex}] must stay inside the disposable repository`);
      }
      return artifact;
    }),
  };
}

function assertUnique(items: { id: string }[], path: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) throw new Error(`${path} contains duplicate id ${item.id}`);
    seen.add(item.id);
  }
}

export function parseManifest(value: unknown, manifestDirectory = process.cwd()): EvalManifest {
  const parsed = object(value, "manifest");
  if (parsed.version !== 1) throw new Error("manifest.version must be 1");
  const evaluationId = id(parsed.id, "manifest.id");
  const repository = object(parsed.repository, "manifest.repository");
  if (!Array.isArray(parsed.profiles) || parsed.profiles.length === 0) throw new Error("manifest.profiles must be a non-empty array");
  if (!Array.isArray(parsed.scenarios) || parsed.scenarios.length === 0) throw new Error("manifest.scenarios must be a non-empty array");

  const profiles = parsed.profiles.map(profile);
  const scenarios = parsed.scenarios.map(scenario);
  assertUnique(profiles, "manifest.profiles");
  assertUnique(scenarios, "manifest.scenarios");

  const repositoryPath = resolve(manifestDirectory, string(repository.path, "manifest.repository.path"));
  const configuredOutput = parsed.outputDirectory === undefined
    ? resolve(homedir(), ".pi", "agent", "evals", evaluationId)
    : string(parsed.outputDirectory, "manifest.outputDirectory");
  const outputDirectory = isAbsolute(configuredOutput) ? configuredOutput : resolve(manifestDirectory, configuredOutput);

  return {
    version: 1,
    id: evaluationId,
    outputDirectory,
    repository: { path: repositoryPath, ref: string(repository.ref, "manifest.repository.ref") },
    profiles: profiles.map((item) => item.package
      ? { ...item, package: { ...item.package, path: resolve(manifestDirectory, item.package.path) } }
      : item),
    scenarios,
  };
}

export function expandMatrix(manifest: EvalManifest): MatrixRun[] {
  return manifest.scenarios.flatMap((scenarioItem) =>
    manifest.profiles.map((profileItem) => ({ scenario: scenarioItem, profile: profileItem })),
  );
}

export function previewManifest(manifest: EvalManifest) {
  const runs = expandMatrix(manifest);
  return {
    evaluationId: manifest.id,
    scenarios: manifest.scenarios.map(({ id }) => id),
    profiles: manifest.profiles.map(({ id }) => id),
    totalRuns: runs.length,
    runs: runs.map(({ scenario, profile }) => ({
      scenarioId: scenario.id,
      profileId: profile.id,
      model: profile.model,
      thinking: profile.thinking,
      tools: profile.execution?.tools ?? DEFAULT_TOOLS,
      packageResources: profile.package?.resources ?? {},
    })),
    outputDirectory: manifest.outputDirectory,
  };
}

const PINNED_PI_PACKAGE_URL = new URL("../node_modules/@earendil-works/pi-coding-agent/package.json", import.meta.url);
const PINNED_PI_CLI = fileURLToPath(new URL("./dist/bundle/cli.js", PINNED_PI_PACKAGE_URL));
export const PINNED_PI_VERSION = (JSON.parse(readFileSync(PINNED_PI_PACKAGE_URL, "utf8")) as { version: string }).version;
export function buildPiInvocation(
  profile: EvalProfile,
  sessionDirectory: string,
  prompt: string,
  packageDirectory?: string,
): PiInvocation {
  const args = [
    PINNED_PI_CLI,
    "--mode", "json",
    "--model", profile.model,
    "--thinking", profile.thinking,
    "--session-dir", sessionDirectory,
    "--tools", (profile.execution?.tools ?? DEFAULT_TOOLS).join(","),
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-themes",
  ];
  if (packageDirectory) {
    const resources = profile.package?.resources;
    for (const path of resources?.skills ?? []) args.push("--skill", join(packageDirectory, path));
    for (const path of resources?.prompts ?? []) args.push("--prompt-template", join(packageDirectory, path));
    for (const path of resources?.extensions ?? []) args.push("--extension", join(packageDirectory, path));
  }
  args.push("--approve", "--", profile.workflow ? `${profile.workflow} ${prompt}` : prompt);
  return { command: process.execPath, args };
}

function runProcess(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv; timeoutMs?: number },
): Promise<ProcessResult> {
  return new Promise((resolveProcess) => {
    const started = Date.now();
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    const timer = options.timeoutMs === undefined ? undefined : setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 250).unref();
    }, options.timeoutMs);
    const finish = (exitCode: number | null, signal: NodeJS.Signals | null, spawnError?: Error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (spawnError) stderr += `${spawnError.message}\n`;
      resolveProcess({ exitCode, signal, timedOut, stdout, stderr, durationMs: Date.now() - started });
    };
    child.on("error", (error) => finish(null, null, error));
    child.on("close", (exitCode, signal) => finish(exitCode, signal));
  });
}

async function git(cwd: string, args: string[]): Promise<ProcessResult> {
  return runProcess("git", args, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
}

async function requireGitOutput(cwd: string, args: string[], description: string): Promise<string> {
  const result = await git(cwd, args);
  if (result.exitCode !== 0) throw new Error(`${description}: ${result.stderr.trim() || result.stdout.trim()}`);
  return result.stdout;
}

async function requireGit(cwd: string, args: string[], description: string): Promise<string> {
  return (await requireGitOutput(cwd, args, description)).trim();
}

function safeChildEnvironment(
  homeDirectory: string,
  agentDirectory: string,
  overrides?: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const env = { ...process.env, ...overrides };
  for (const name of [
    "GH_TOKEN",
    "GH_ENTERPRISE_TOKEN",
    "GITHUB_TOKEN",
    "GITLAB_TOKEN",
    "NPM_TOKEN",
    "NODE_AUTH_TOKEN",
    "SSH_AUTH_SOCK",
    "SSH_ASKPASS",
    "GIT_ASKPASS",
    "GIT_CONFIG_GLOBAL",
    "GIT_CONFIG_SYSTEM",
  ]) {
    delete env[name];
  }
  return {
    ...env,
    HOME: homeDirectory,
    XDG_CACHE_HOME: join(homeDirectory, ".cache"),
    XDG_CONFIG_HOME: join(homeDirectory, ".config"),
    XDG_DATA_HOME: join(homeDirectory, ".local", "share"),
    NPM_CONFIG_USERCONFIG: join(homeDirectory, ".npmrc"),
    PI_CODING_AGENT_DIR: agentDirectory,
    CI: "1",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    PI_SKIP_VERSION_CHECK: "1",
  };
}

async function prepareIsolatedUserState(
  runDirectory: string,
  sourceAgentDirectory: string,
): Promise<{ homeDirectory: string; agentDirectory: string }> {
  const homeDirectory = join(runDirectory, "home");
  const agentDirectory = join(runDirectory, "agent-config");
  await mkdir(agentDirectory, { recursive: true });
  await mkdir(homeDirectory, { recursive: true });
  await writeFile(join(homeDirectory, ".npmrc"), "");
  for (const file of ["auth.json", "models.json", "models-store.json"]) {
    try {
      await cp(join(sourceAgentDirectory, file), join(agentDirectory, file));
    } catch { /* Optional Pi authentication/catalog files may be absent. */ }
  }
  return { homeDirectory, agentDirectory };
}

async function cloneAt(source: string, sha: string, destination: string): Promise<void> {
  const parent = dirname(destination);
  await mkdir(parent, { recursive: true });
  const clone = await git(parent, ["clone", "--quiet", "--no-hardlinks", "--no-checkout", source, destination]);
  if (clone.exitCode !== 0) throw new Error(`git clone failed: ${clone.stderr.trim()}`);
  await requireGit(destination, ["checkout", "--quiet", "--detach", sha], "git checkout failed");
  await requireGit(destination, ["config", "user.name", "Pi Evaluation"], "cannot set disposable Git identity");
  await requireGit(destination, ["config", "user.email", "pi-evaluation@localhost"], "cannot set disposable Git identity");
  const remotes = await requireGit(destination, ["remote"], "git remote failed");
  for (const remote of remotes.split("\n").filter(Boolean)) {
    await requireGit(destination, ["remote", "remove", remote], `cannot remove git remote ${remote}`);
  }
}

async function findFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(current: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await walk(path);
      else files.push(path);
    }
  }
  try { await walk(directory); } catch { return []; }
  return files;
}

export async function collectRunSessionTelemetry(sessionDirectory: string): Promise<RunSessionTelemetry> {
  const paths = (await findFiles(sessionDirectory)).filter((path) => path.endsWith(".jsonl")).sort();
  const sessions = (await Promise.all(paths.map(async (path) => {
    try { return parsePiSessionLines(await readFile(path, "utf8"), path); }
    catch { return null; }
  }))).filter((session) => session !== null);
  const hasSessions = sessions.length > 0;
  const available = (key: keyof (typeof sessions)[number]["availability"]) => sessions.some((session) => session.availability[key]);
  const sum = (select: (session: (typeof sessions)[number]) => number) => sessions.reduce((total, session) => total + select(session), 0);
  const contextSamples = sessions.flatMap((session) => session.contextTokenSamples);
  const modelsUsed = [...new Set(sessions.flatMap((session) => [...session.modelsUsed]))].sort();
  const thinkingLevelsUsed = [...new Set(sessions.flatMap((session) => [...session.thinkingLevelsUsed]))].sort();
  const actualConfiguration = sessions.reduce<RunSessionTelemetry["actualConfiguration"]>(
    (actual, session) => ({
      provider: session.actualConfiguration.provider ?? actual.provider,
      model: session.actualConfiguration.model ?? actual.model,
      thinking: session.actualConfiguration.thinking ?? actual.thinking,
    }),
    { provider: null, model: null, thinking: null },
  );
  const reportedAvailable = available("reportedCost");
  const estimatedAvailable = available("estimatedCost");
  const reportedCost = sum((session) => session.totalCost - session.estimatedCost);
  const estimatedCost = sum((session) => session.estimatedCost);

  return {
    sessions: sessions.map((session) => ({
      file: relative(sessionDirectory, session.filePath),
      id: session.sessionId,
      startedAt: session.startedAt?.toISOString() ?? null,
      cwd: session.cwd,
    })),
    messages: hasSessions ? sum((session) => session.messages) : null,
    assistantTurns: hasSessions ? sum((session) => session.assistantTurns) : null,
    tokens: {
      input: available("inputTokens") ? sum((session) => session.inputTokens) : null,
      output: available("outputTokens") ? sum((session) => session.outputTokens) : null,
      cacheRead: available("cacheReadTokens") ? sum((session) => session.cacheReadTokens) : null,
      cacheWrite: available("cacheWriteTokens") ? sum((session) => session.cacheWriteTokens) : null,
      total: available("totalTokens") ? sum((session) => session.tokens) : null,
    },
    cost: {
      reported: reportedAvailable ? reportedCost : null,
      estimated: estimatedAvailable ? estimatedCost : null,
      total: reportedAvailable || estimatedAvailable ? reportedCost + estimatedCost : null,
      currency: "USD",
    },
    context: {
      samples: contextSamples,
      initial: contextSamples.at(0) ?? null,
      peak: contextSamples.length > 0 ? Math.max(...contextSamples) : null,
      final: contextSamples.at(-1) ?? null,
      max: available("maxContext") ? Math.max(...sessions.map((session) => session.maxContextTokens)) : null,
    },
    modelsUsed,
    thinkingLevelsUsed,
    actualConfiguration,
    malformedLines: sum((session) => session.skippedLines),
  };
}

function changedFiles(status: string): string[] {
  return status.split("\n").filter(Boolean).map((line) => {
    const path = line.slice(3);
    return path.includes(" -> ") ? path.split(" -> ").at(-1)! : path;
  }).sort();
}

function commitSummary(log: string): Array<{ sha: string; subject: string }> {
  return log.split("\n").filter(Boolean).map((line) => {
    const separator = line.indexOf("\t");
    return separator === -1
      ? { sha: line, subject: "" }
      : { sha: line.slice(0, separator), subject: line.slice(separator + 1) };
  });
}

function inside(path: string, parent: string): boolean {
  const rel = relative(resolve(parent), resolve(path));
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== "..");
}

async function executeRun(
  manifest: EvalManifest,
  matrixRun: MatrixRun,
  baseSha: string,
  packageSha: string | undefined,
  dependencies: EvaluationDependencies,
): Promise<RunResult> {
  const { scenario, profile } = matrixRun;
  const runRelative = join("runs", scenario.id, profile.id);
  const runDirectory = join(manifest.outputDirectory, runRelative);
  const repositoryDirectory = join(runDirectory, "repository");
  const sessionDirectory = join(runDirectory, "session");
  const sourceAgentDirectory = resolve(
    dependencies.agentDirectory ?? process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"),
  );
  const { homeDirectory, agentDirectory } = await prepareIsolatedUserState(runDirectory, sourceAgentDirectory);
  const childEnvironment = safeChildEnvironment(homeDirectory, agentDirectory, dependencies.environment);
  const startedAt = new Date().toISOString();
  await mkdir(runDirectory, { recursive: true });

  let child: ProcessResult = { exitCode: null, signal: null, timedOut: false, stdout: "", stderr: "", durationMs: 0 };
  let error: string | undefined;
  let packageDirectory: string | undefined;
  let verification: RunResult["verification"] = [];
  let gitStatus = "";
  let diff = "";
  let commits = "";
  let artifacts: string[] = [];

  try {
    await cloneAt(manifest.repository.path, baseSha, repositoryDirectory);
    if (profile.package && packageSha) {
      packageDirectory = join(runDirectory, "package");
      await cloneAt(profile.package.path, packageSha, packageDirectory);
    }
    await mkdir(sessionDirectory, { recursive: true });
    const invocation = buildPiInvocation(profile, sessionDirectory, scenario.prompt, packageDirectory);
    const command = dependencies.piCommand
      ? { command: dependencies.piCommand.command, args: [...dependencies.piCommand.leadingArgs ?? [], ...invocation.args.slice(1)] }
      : invocation;
    child = await runProcess(command.command, command.args, {
      cwd: repositoryDirectory,
      env: childEnvironment,
      timeoutMs: scenario.timeoutMs,
    });
    await writeFile(join(runDirectory, "stdout.log"), child.stdout);
    await writeFile(join(runDirectory, "stderr.log"), child.stderr);

    for (const [index, check] of (scenario.verify ?? []).entries()) {
      const outcome = await runProcess(check.command, check.args ?? [], {
        cwd: repositoryDirectory,
        env: childEnvironment,
        timeoutMs: check.timeoutMs,
      });
      await writeFile(join(runDirectory, `verification-${index}.stdout.log`), outcome.stdout);
      await writeFile(join(runDirectory, `verification-${index}.stderr.log`), outcome.stderr);
      verification.push({
        command: [check.command, ...check.args ?? []],
        status: outcome.timedOut ? "timed_out" : outcome.exitCode === 0 ? "passed" : "failed",
        exitCode: outcome.exitCode,
        durationMs: outcome.durationMs,
      });
    }

    gitStatus = await requireGitOutput(repositoryDirectory, ["status", "--porcelain=v1"], "cannot capture Git status");
    await requireGit(repositoryDirectory, ["add", "--intent-to-add", "--all"], "cannot include untracked files in retained diff");
    diff = await requireGitOutput(repositoryDirectory, ["diff", "--binary", baseSha], "cannot capture retained diff");
    await requireGit(repositoryDirectory, ["reset", "--quiet"], "cannot restore Git index after evidence capture");
    commits = await requireGitOutput(
      repositoryDirectory,
      ["log", "--format=%H%x09%s", `${baseSha}..HEAD`],
      "cannot capture commit history",
    );
    await writeFile(join(runDirectory, "git-status.txt"), gitStatus);
    await writeFile(join(runDirectory, "diff.patch"), diff);
    await writeFile(join(runDirectory, "commits.txt"), commits);

    for (const artifact of scenario.artifacts ?? []) {
      const source = join(repositoryDirectory, artifact);
      const destinationRelative = join(runRelative, "artifacts", artifact);
      try {
        await cp(source, join(manifest.outputDirectory, destinationRelative), { recursive: true });
        artifacts.push(destinationRelative);
      } catch { /* Missing requested artifacts are reflected by their absence. */ }
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
    await writeFile(join(runDirectory, "stdout.log"), child.stdout);
    await writeFile(join(runDirectory, "stderr.log"), `${child.stderr}${error}\n`);
  }

  const telemetry = await collectRunSessionTelemetry(sessionDirectory);
  const parsedActual = telemetry.actualConfiguration;
  const actual: RunResult["actualConfiguration"] = parsedActual.provider && parsedActual.model && parsedActual.thinking
    ? { provider: parsedActual.provider, model: parsedActual.model, thinking: parsedActual.thinking }
    : null;

  const requested = profile.model.split("/");
  const requestedProvider = requested.shift()!;
  const configurationMatched = actual !== null
    && actual.provider === requestedProvider
    && actual.model === requested.join("/")
    && actual.thinking === profile.thinking;
  const status: RunResult["status"] = error ? "runner_error"
    : child.timedOut ? "timed_out"
    : child.exitCode !== 0 ? "child_failed"
    : !configurationMatched ? "configuration_mismatch"
    : verification.some((item) => item.status !== "passed") ? "verification_failed"
    : "passed";
  const result: RunResult = {
    schemaVersion: 1,
    evaluationId: manifest.id,
    scenarioId: scenario.id,
    profileId: profile.id,
    status,
    piVersion: PINNED_PI_VERSION,
    requestedConfiguration: { model: profile.model, thinking: profile.thinking },
    executionPolicy: {
      tools: profile.execution?.tools ?? DEFAULT_TOOLS,
      packageResources: profile.package?.resources ?? {},
    },
    package: profile.package && packageSha
      ? { source: profile.package.path, ref: profile.package.ref, sha: packageSha }
      : null,
    actualConfiguration: actual,
    configurationMatched,
    telemetry,
    repository: { source: manifest.repository.path, ref: manifest.repository.ref, baseSha },
    child: {
      exitCode: child.exitCode,
      signal: child.signal,
      timedOut: child.timedOut,
      durationMs: child.durationMs,
    },
    verification,
    git: {
      status: gitStatus,
      changedFiles: changedFiles(gitStatus),
      commits: commitSummary(commits),
      diffPath: join(runRelative, "diff.patch"),
      commitsPath: join(runRelative, "commits.txt"),
    },
    artifacts,
    paths: {
      stdout: join(runRelative, "stdout.log"),
      stderr: join(runRelative, "stderr.log"),
      sessionDirectory: join(runRelative, "session"),
      result: join(runRelative, "result.json"),
    },
    startedAt,
    finishedAt: new Date().toISOString(),
    ...(error ? { error } : {}),
  };
  await writeFile(join(runDirectory, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
  await rm(repositoryDirectory, { recursive: true, force: true });
  if (packageDirectory) await rm(packageDirectory, { recursive: true, force: true });
  await rm(homeDirectory, { recursive: true, force: true });
  await rm(agentDirectory, { recursive: true, force: true });
  return result;
}

export async function runEvaluation(
  manifest: EvalManifest,
  dependencies: EvaluationDependencies = {},
): Promise<RunResult[]> {
  if (inside(manifest.outputDirectory, manifest.repository.path) || inside(manifest.outputDirectory, process.cwd())) {
    throw new Error("Evaluation output directory must be outside the target repository and invoking checkout");
  }
  const baseSha = await requireGit(manifest.repository.path, ["rev-parse", `${manifest.repository.ref}^{commit}`], "cannot resolve repository ref");
  const packageShas = new Map<string, string>();
  for (const profile of manifest.profiles) {
    if (!profile.package) continue;
    packageShas.set(
      profile.id,
      await requireGit(profile.package.path, ["rev-parse", `${profile.package.ref}^{commit}`], `cannot resolve package ref for ${profile.id}`),
    );
  }
  await mkdir(manifest.outputDirectory, { recursive: true });
  await writeFile(join(manifest.outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const results: RunResult[] = [];
  for (const matrixRun of expandMatrix(manifest)) {
    results.push(await executeRun(manifest, matrixRun, baseSha, packageShas.get(matrixRun.profile.id), dependencies));
  }
  await writeEvaluationOutputs(manifest.outputDirectory, buildCanonicalEvaluationResult(manifest, results));
  return results;
}

async function loadManifest(path: string): Promise<EvalManifest> {
  const absolutePath = resolve(path);
  let value: unknown;
  try {
    value = JSON.parse(await readFile(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read JSON manifest ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return parseManifest(value, resolve(absolutePath, ".."));
}

async function main(args: string[]): Promise<void> {
  if (args[0] === "--report") {
    if (!args[1] || args.length > 3) throw new Error("Usage: pac-eval --report <results.json> [report.html]");
    await regenerateEvaluationReport(resolve(args[1]), args[2] ? resolve(args[2]) : undefined);
    return;
  }
  const manifestPath = args.find((arg) => !arg.startsWith("-"));
  if (!manifestPath) throw new Error("Usage: pac-eval <manifest.json> [--dry-run] | pac-eval --report <results.json> [report.html]");
  const manifest = await loadManifest(manifestPath);
  if (args.includes("--dry-run")) {
    process.stdout.write(`${JSON.stringify(previewManifest(manifest), null, 2)}\n`);
    return;
  }
  process.stderr.write(`Evaluation plan:\n${JSON.stringify(previewManifest(manifest), null, 2)}\n`);
  const results = await runEvaluation(manifest);
  process.stdout.write(`${JSON.stringify({ evaluationId: manifest.id, outputDirectory: manifest.outputDirectory, results }, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
