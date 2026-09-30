import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(source, "../..");
const outputRoot = path.resolve(process.argv[2] ?? "");
assert.ok(process.argv[2], "usage: node build-fixtures.mjs <disposable-output-directory>");
assert.notEqual(outputRoot, packageRoot, "refusing to replace the package repository");

const definitions = [
	{
		id: "main-fallback",
		defaultBranch: "main",
		workflow: undefined,
		prompt: "Run `node setup-fixture.mjs`, then implement only REQUEST.md. This is partial issue #9001 work. You may create a verified commit, but you are not authorized to push or merge. After implementation, write the proposed pull-request body to `.fixture-state/pull-request-body.md`. Do not reread complete/current repository policy already present in context.",
	},
	{
		id: "develop-local",
		defaultBranch: "develop",
		workflow: "/pac-lwot",
		prompt: "Run `node setup-fixture.mjs`, then implement only REQUEST.md. This is a complete issue #9001 implementation. Create a verified commit and push only the policy-authorized feature branch. Do not merge. The user will create a minimal pull-request body without issue links, so closure must come from the completing commit. Do not reread complete/current AGENTS.md already present in context.",
	},
	{
		id: "guarded-hook",
		defaultBranch: "main",
		workflow: undefined,
		prompt: "Run `node setup-fixture.mjs`, then implement only REQUEST.md. This is partial issue #9001 work. You may create a verified commit and I authorize pushing it, but you are not authorized to merge. After implementation, write the proposed pull-request body to `.fixture-state/pull-request-body.md`. Apply stronger repository restrictions and re-check repository state after hooks run. Do not reread complete/current AGENTS.md already present in context.",
	},
	{
		id: "multi-commit-local",
		defaultBranch: "develop",
		workflow: "/pac-lwot",
		prompt: "Run `node setup-fixture.mjs`, then implement only REQUEST.md as the explicitly requested partial then completing commits for issue #9001. Create both verified commits, but do not push or merge. The user will create a minimal pull-request body without issue links. Do not reread complete/current AGENTS.md already present in context.",
	},
];

await rm(outputRoot, { recursive: true, force: true });
await mkdir(path.join(outputRoot, "manifests"), { recursive: true });

for (const definition of definitions) {
	const repository = path.join(outputRoot, "repositories", definition.id);
	await mkdir(repository, { recursive: true });
	await cp(path.join(source, "templates", definition.id), repository, { recursive: true });
	await cp(path.join(source, "fixture-support", "setup-fixture.mjs"), path.join(repository, "setup-fixture.mjs"));
	await cp(path.join(source, "fixture-support", "verify-fixture.mjs"), path.join(repository, "verify-fixture.mjs"));

	const git = (...args) => execFileSync("git", args, { cwd: repository, encoding: "utf8", stdio: "pipe" }).trim();
	git("init", "-q", "-b", definition.defaultBranch);
	git("config", "user.name", "Downstream Fixture");
	git("config", "user.email", "fixture@example.invalid");
	git("add", "--all");
	git("commit", "-q", "-m", "fixture baseline");
	git("tag", "fixture-baseline");

	const profile = {
		id: definition.workflow ? "lwot" : "natural-language",
		model: process.env.PAC_EVAL_MODEL ?? "openai-codex/gpt-6-luna",
		thinking: process.env.PAC_EVAL_THINKING ?? "medium",
		...(definition.workflow ? { workflow: definition.workflow } : {}),
		execution: { tools: ["read", "bash", "edit", "write", "grep", "find", "ls"] },
		package: {
			path: packageRoot,
			ref: "HEAD",
			resources: {
				prompts: definition.workflow ? ["prompts/pac-lwot.md"] : [],
				skills: ["skills/pac-commit"],
				extensions: ["extensions/shared-append-system/index.ts"],
			},
		},
	};
	const manifest = {
		$schema: path.join(packageRoot, "schemas", "pac-eval-manifest.schema.json"),
		version: 1,
		id: `downstream-behavior-${definition.id}`,
		outputDirectory: path.join(outputRoot, "results", definition.id),
		repository: { path: repository, ref: "HEAD" },
		profiles: [profile],
		scenarios: [{
			id: definition.id,
			prompt: definition.prompt,
			timeoutMs: 300000,
			verify: [{ command: "node", args: ["verify-fixture.mjs", definition.id], timeoutMs: 30000 }],
		}],
	};
	await writeFile(path.join(outputRoot, "manifests", `${definition.id}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
}

process.stdout.write(`${outputRoot}\n`);
