import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const sourcePackageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
const hostDependencies = sourcePackageJson.peerDependencies;
const expectedExtensions = [
	"answer", "ask", "btw", "compact-verification-output", "context", "footer", "ghi", "headroom", "notify",
	"pac-setup-workflows", "personas", "review", "session-breakdown", "session-names", "shared-append-system",
	"slidedeck", "undo", "uv", "whimsical", "worktrunk",
];
const expectedSkills = [
	"pac-caveman", "pac-changelog", "pac-commit", "pac-deep-read", "pac-diagnose", "pac-explore", "pac-github",
	"pac-github-issue-create", "pac-grill-me", "pac-grill-with-docs", "pac-handoff", "pac-improve-architecture",
	"pac-librarian", "pac-pi-extension", "pac-pi-prompt", "pac-pi-skill", "pac-review",
	"pac-review-standards-spec", "pac-session-review", "pac-slidedeck", "pac-tdd", "pac-to-issues", "pac-to-prd", "pac-triage",
	"pac-upstream-checkpoints", "pac-uv", "pac-zoom-out",
];
const expectedPrompts = [
	"pac-caveman", "pac-deep-read", "pac-diagnose", "pac-explore", "pac-fix-copilot-review", "pac-grill-me",
	"pac-grill-with-docs", "pac-handoff", "pac-hello-world", "pac-improve-architecture",
	"pac-llat", "pac-lwot", "pac-session-review", "pac-to-issues", "pac-to-prd", "pac-triage", "pac-upstream-checkpoints",
	"pac-zoom-out",
];
const expectedThemes = ["gruvbox-dark", "nightowl", "nord"];

let fixtureRoot;
let consumerDir;
let installedPackageDir;
let pi;

async function createLoader(packageDir, { projectTrusted = true, projectPackage = false } = {}) {
	const root = await mkdtemp(path.join(fixtureRoot, "loader-"));
	const cwd = path.join(root, "project");
	const agentDir = path.join(root, "agent");
	await mkdir(path.join(cwd, ".pi"), { recursive: true });
	await mkdir(agentDir, { recursive: true });
	await writeFile(
		projectPackage ? path.join(cwd, ".pi", "settings.json") : path.join(agentDir, "settings.json"),
		JSON.stringify({ packages: [packageDir] }),
	);

	const settingsManager = pi.SettingsManager.create(cwd, agentDir, { projectTrusted });
	const loader = new pi.DefaultResourceLoader({ cwd, agentDir, settingsManager, noContextFiles: true });
	await loader.reload();
	return loader;
}

async function copyInstalledPackage(name) {
	const destination = path.join(fixtureRoot, name);
	await cp(installedPackageDir, destination, { recursive: true });
	return destination;
}

function extensionNames(loader) {
	return loader.getExtensions().extensions.map((extension) => path.basename(path.dirname(extension.path))).sort();
}

before(async () => {
	fixtureRoot = await mkdtemp(path.join(tmpdir(), "mypac-consumer-"));
	const packDir = path.join(fixtureRoot, "pack");
	consumerDir = path.join(fixtureRoot, "consumer");
	await mkdir(packDir);
	await mkdir(consumerDir);

	const { stdout } = await execFileAsync("npm", ["pack", "--silent", "--json", "--pack-destination", packDir], {
		cwd: repoRoot,
	});
	const [{ filename }] = JSON.parse(stdout);
	const packageJson = {
		name: "mypac-consumer-fixture",
		version: "1.0.0",
		private: true,
		dependencies: {
			mypac: `file:${path.join(packDir, filename)}`,
			...hostDependencies,
		},
	};
	await writeFile(path.join(consumerDir, "package.json"), JSON.stringify(packageJson, null, 2));
	await execFileAsync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: consumerDir });
	await execFileAsync("npm", ["ls", "--all", "--json"], { cwd: consumerDir, maxBuffer: 10 * 1024 * 1024 });

	// Copies stay outside node_modules for native TS imports, but retain access to
	// the consumer's installed dependencies through their ancestor lookup path.
	await symlink(path.join(consumerDir, "node_modules"), path.join(fixtureRoot, "node_modules"), "dir");
	installedPackageDir = path.join(consumerDir, "node_modules", "mypac");
	pi = await import(pathToFileURL(path.join(consumerDir, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "index.js")));
});

after(async () => {
	await rm(fixtureRoot, { recursive: true, force: true });
});

test("clean consumer install discovers every packaged Pi resource", async () => {
	const loader = await createLoader(installedPackageDir);
	assert.deepEqual(loader.getExtensions().errors, []);
	assert.deepEqual(extensionNames(loader), expectedExtensions);
	assert.deepEqual(loader.getSkills().skills.map((skill) => skill.name).sort(), expectedSkills);
	assert.deepEqual(loader.getPrompts().prompts.map((prompt) => prompt.name).sort(), expectedPrompts);
	assert.deepEqual(loader.getThemes().themes.map((theme) => theme.name).sort(), expectedThemes);
	assert.deepEqual(loader.getSkills().diagnostics, []);
	assert.deepEqual(loader.getPrompts().diagnostics, []);
	assert.deepEqual(loader.getThemes().diagnostics, []);
});

test("installed uv wrapper loads its packaged Bash parser before execution", async () => {
	const loader = await createLoader(installedPackageDir);
	const extension = loader.getExtensions().extensions.find((entry) => path.basename(path.dirname(entry.path)) === "uv");
	const bash = extension.tools.get("bash").definition;
	const result = await bash.execute("consumer-data", { command: "cat <<'ONE' <<'TWO'\npython -m pip\nONE\npip install example\nTWO" });
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /pip install example/);
	await assert.rejects(bash.execute("consumer-blocked", { command: ".venv/bin/python -m pip" }), /python -m pip.*is disabled/);
});

test("consumer resources reload from the installed package", async () => {
	const packageDir = await copyInstalledPackage("reload-package");
	const loader = await createLoader(packageDir);
	assert.equal(loader.getPrompts().prompts.some((prompt) => prompt.name === "consumer-reload"), false);

	await writeFile(path.join(packageDir, "prompts", "consumer-reload.md"), "Reloaded package prompt.\n");
	await loader.reload();
	assert.equal(loader.getPrompts().prompts.some((prompt) => prompt.name === "consumer-reload"), true);
});

test("malformed package resources are actionable without hiding unrelated resources", async () => {
	const packageDir = await copyInstalledPackage("malformed-package");
	await mkdir(path.join(packageDir, "extensions", "malformed"));
	await writeFile(path.join(packageDir, "extensions", "malformed", "index.ts"), "throw new Error('consumer fixture extension failure');\n");
	await writeFile(path.join(packageDir, "themes", "malformed.json"), "{ not-json\n");

	const loader = await createLoader(packageDir);
	assert.deepEqual(extensionNames(loader), expectedExtensions);
	assert.equal(loader.getExtensions().errors.length, 1);
	assert.match(loader.getExtensions().errors[0].path, /extensions[/\\]malformed[/\\]index\.ts$/);
	assert.match(loader.getExtensions().errors[0].error, /consumer fixture extension failure/);
	assert.deepEqual(loader.getSkills().skills.map((skill) => skill.name).sort(), expectedSkills);
	assert.deepEqual(loader.getPrompts().prompts.map((prompt) => prompt.name).sort(), expectedPrompts);
	assert.deepEqual(loader.getThemes().themes.map((theme) => theme.name).sort(), expectedThemes);
	assert.equal(loader.getThemes().diagnostics.length, 1);
	assert.match(loader.getThemes().diagnostics[0].path, /themes[/\\]malformed\.json$/);
});

test("project package resources load only after project trust", async () => {
	const untrusted = await createLoader(installedPackageDir, { projectTrusted: false, projectPackage: true });
	assert.deepEqual(extensionNames(untrusted), []);
	assert.deepEqual(untrusted.getSkills().skills, []);
	assert.deepEqual(untrusted.getPrompts().prompts, []);
	assert.deepEqual(untrusted.getThemes().themes, []);

	const trusted = await createLoader(installedPackageDir, { projectTrusted: true, projectPackage: true });
	assert.deepEqual(extensionNames(trusted), expectedExtensions);
	assert.deepEqual(trusted.getSkills().skills.map((skill) => skill.name).sort(), expectedSkills);
});

test("installed prompts use Pi defaults and explicit argument expansion", async () => {
	const packageDir = await copyInstalledPackage("prompt-package");
	await writeFile(path.join(packageDir, "prompts", "consumer-default.md"), "Value: ${1:-fallback}\n");
	const loader = await createLoader(packageDir);
	const { expandPromptTemplate } = await import(pathToFileURL(path.join(consumerDir, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "core", "prompt-templates.js")));
	const prompts = loader.getPrompts().prompts;

	assert.equal(expandPromptTemplate("/consumer-default", prompts), "Value: fallback\n");
	assert.equal(expandPromptTemplate("/consumer-default explicit", prompts), "Value: explicit\n");
	assert.match(expandPromptTemplate("/pac-lwot issue 329", prompts), /\*\*Provided arguments\*\*: issue 329$/);
	const issueOnly = expandPromptTemplate("/pac-lwot https://github.com/ladislas/mypac/issues/501", prompts);
	assert.match(issueOnly, /\*\*Provided arguments\*\*: https:\/\/github\.com\/ladislas\/mypac\/issues\/501$/);
	assert.match(expandPromptTemplate("/pac-deep-read long strategy memo", prompts), /\*\*Provided arguments\*\*: long strategy memo$/);
	assert.equal(expandPromptTemplate("/pac-lwot issue 329", []), "/pac-lwot issue 329");
});

test("installed persona and append-system resources compose into the system prompt", async () => {
	const packageDir = await copyInstalledPackage("composition-package");
	// Personas are mypac-managed resources, and append-system composition is extension behavior;
	// Pi exposes neither through a package-level API, so validate their installed extension seams directly.
	const personaHelpers = await import(pathToFileURL(path.join(packageDir, "extensions", "personas", "helpers.ts")));
	const appendHelpers = await import(pathToFileURL(path.join(packageDir, "extensions", "shared-append-system", "prompt.ts")));
	const personas = await personaHelpers.loadPersonas(packageDir);
	assert.deepEqual(personas.map((persona) => persona.name), ["rick"]);

	const sharedPath = path.join(packageDir, "shared", "SHARED_APPEND_SYSTEM.md");
	const sharedContent = await readFile(sharedPath, "utf8");
	assert.equal(sharedContent, await readFile(path.join(repoRoot, "shared", "SHARED_APPEND_SYSTEM.md"), "utf8"));
	assert.ok(sharedContent.trim().length > 0);
	const sharedBlock = appendHelpers.formatSharedAppendSystemPrompt(sharedContent, sharedPath);
	const appendPrompt = "Consumer append-system prompt";
	const composed = appendHelpers.insertSharedAppendSystemPrompt(`Pi base\n\n${appendPrompt}`, sharedBlock, appendPrompt);
	assert.ok(composed.includes(`\n${sharedContent.trim()}\n`), "installed instructions must survive composition verbatim");
	assert.ok(composed.indexOf(sharedContent.trim()) < composed.indexOf(appendPrompt));
	assert.ok(composed.indexOf("Pi base") < composed.indexOf("<shared_append_system_context>"));
	assert.ok(composed.indexOf("<shared_append_system_context>") < composed.indexOf(appendPrompt));
});
