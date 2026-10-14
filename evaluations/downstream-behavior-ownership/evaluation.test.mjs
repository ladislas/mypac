import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseManifest } from "../../scripts/pac-eval.ts";

const here = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(here, "../..");

async function build() {
	const root = await mkdtemp(path.join(os.tmpdir(), "mypac-downstream-behavior-"));
	execFileSync("node", [path.join(here, "build-fixtures.mjs"), root], { cwd: repoRoot });
	return root;
}

test("builds four disposable downstream Git repositories and preserves their policy templates", async (t) => {
	const root = await build();
	t.after(() => rm(root, { recursive: true, force: true }));
	const git = (repository, ...args) => execFileSync("git", args, { cwd: repository, encoding: "utf8" }).trim();

	for (const [id, defaultBranch] of [["main-fallback", "main"], ["develop-local", "develop"], ["guarded-hook", "main"], ["multi-commit-local", "develop"]]) {
		const repository = path.join(root, "repositories", id);
		assert.equal(git(repository, "branch", "--show-current"), defaultBranch);
		assert.equal(git(repository, "status", "--porcelain=v1"), "");
		assert.equal(git(repository, "tag", "--list", "fixture-baseline"), "fixture-baseline");
		if (id !== "main-fallback") {
			assert.equal(
				await readFile(path.join(repository, "AGENTS.md"), "utf8"),
				await readFile(path.join(here, "templates", id, "AGENTS.md"), "utf8"),
			);
		}
	}

	await assert.rejects(readFile(path.join(root, "repositories", "main-fallback", "AGENTS.md"), "utf8"));
});

test("generated manifests validate and cover natural-language and pac-lwot entrypoints", async (t) => {
	const root = await build();
	t.after(() => rm(root, { recursive: true, force: true }));
	const manifests = await Promise.all(["main-fallback", "develop-local", "guarded-hook", "multi-commit-local"].map(async (id) =>
		parseManifest(JSON.parse(await readFile(path.join(root, "manifests", `${id}.json`), "utf8")), path.join(root, "manifests"))));

	// Entry-point diversity is intentional evaluation structure, not a model/profile snapshot.
	assert.deepEqual(manifests.map(({ profiles }) => profiles[0].workflow ?? "natural-language"), [
		"natural-language",
		"/pac-lwot",
		"natural-language",
		"/pac-lwot",
	]);
	assert.ok(manifests.every(({ profiles, scenarios }) => profiles.length === 1 && scenarios.length === 1));
});
