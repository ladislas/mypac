import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const skillDir = dirname(fileURLToPath(import.meta.url));
const checkoutScript = join(skillDir, "checkout.sh");

function run(command, args, options = {}) {
	const { allowFailure, ...spawnOptions } = options;
	const result = spawnSync(command, args, {
		encoding: "utf8",
		...spawnOptions,
	});

	if (allowFailure !== true && result.status !== 0) {
		throw new Error([
			`Command failed: ${command} ${args.join(" ")}`,
			`status: ${result.status}`,
			`stdout: ${result.stdout}`,
			`stderr: ${result.stderr}`,
		].join("\n"));
	}

	return result;
}

function git(path, ...args) {
	return run("git", ["-C", path, ...args]);
}

function commit(source, message) {
	writeFileSync(join(source, "content.txt"), `${message}\n`, { flag: "a" });
	git(source, "add", "content.txt");
	git(source, "commit", "-m", message);
}

function setupRepository(t, { initialCommits = 4 } = {}) {
	const dir = mkdtempSync(join(tmpdir(), "pac-librarian-integration-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));

	const source = join(dir, "source");
	const origin = join(dir, "origin.git");
	const cacheRoot = join(dir, "cache");
	const checkoutPath = join(cacheRoot, "example.test", "owner", "repo");

	run("git", ["init", "--initial-branch=main", source]);
	git(source, "config", "user.email", "test@example.com");
	git(source, "config", "user.name", "Test User");
	for (let index = 1; index <= initialCommits; index += 1) {
		commit(source, `initial-${index}`);
	}
	run("git", ["clone", "--bare", source, origin]);
	git(source, "remote", "add", "origin", origin);

	const env = {
		...process.env,
		LIBRARIAN_CACHE_ROOT: cacheRoot,
		GIT_CONFIG_COUNT: "1",
		GIT_CONFIG_KEY_0: "url.file://" + origin + ".insteadOf",
		GIT_CONFIG_VALUE_0: "https://example.test/owner/repo.git",
	};

	return { source, origin, checkoutPath, env };
}

function checkout(env, ...args) {
	return run("bash", [checkoutScript, "example.test/owner/repo", "--path-only", ...args], {
		env,
		allowFailure: true,
	});
}

test("refresh fast-forwards a shallow checkout across multiple upstream commits", (t) => {
	const fixture = setupRepository(t);
	const initial = checkout(fixture.env, "--force-update");
	assert.equal(initial.status, 0, initial.stderr);
	assert.equal(git(fixture.checkoutPath, "rev-parse", "--is-shallow-repository").stdout.trim(), "true");

	for (const message of ["upstream-1", "upstream-2", "upstream-3"]) {
		commit(fixture.source, message);
	}
	git(fixture.source, "push", "origin", "main");
	const expectedHead = git(fixture.source, "rev-parse", "HEAD").stdout.trim();

	const refreshed = checkout(fixture.env, "--force-update");
	assert.equal(refreshed.status, 0, refreshed.stderr);
	assert.equal(git(fixture.checkoutPath, "rev-parse", "HEAD").stdout.trim(), expectedHead);
});

test("path-only reports a stale dirty checkout without discarding changes", (t) => {
	const fixture = setupRepository(t);
	assert.equal(checkout(fixture.env, "--force-update").status, 0);
	const originalHead = git(fixture.checkoutPath, "rev-parse", "HEAD").stdout.trim();
	writeFileSync(join(fixture.checkoutPath, "content.txt"), "local change\n", { flag: "a" });

	commit(fixture.source, "upstream-change");
	git(fixture.source, "push", "origin", "main");
	const refreshed = checkout(fixture.env, "--force-update");

	assert.notEqual(refreshed.status, 0);
	assert.equal(refreshed.stdout, "");
	assert.match(refreshed.stderr, /stale.*skipped-dirty/);
	assert.equal(git(fixture.checkoutPath, "rev-parse", "HEAD").stdout.trim(), originalHead);
	assert.match(git(fixture.checkoutPath, "diff", "--", "content.txt").stdout, /local change/);

	const throttledRetry = checkout(fixture.env);
	assert.notEqual(throttledRetry.status, 0);
	assert.equal(throttledRetry.stdout, "");
	assert.match(throttledRetry.stderr, /stale.*skipped-dirty/);
});

test("path-only reports divergent history without discarding the local commit", (t) => {
	const fixture = setupRepository(t);
	assert.equal(checkout(fixture.env, "--force-update").status, 0);
	git(fixture.checkoutPath, "config", "user.email", "test@example.com");
	git(fixture.checkoutPath, "config", "user.name", "Test User");
	commit(fixture.checkoutPath, "local-commit");
	const localHead = git(fixture.checkoutPath, "rev-parse", "HEAD").stdout.trim();

	commit(fixture.source, "upstream-change");
	git(fixture.source, "push", "origin", "main");
	const refreshed = checkout(fixture.env, "--force-update");

	assert.notEqual(refreshed.status, 0);
	assert.equal(refreshed.stdout, "");
	assert.match(refreshed.stderr, /stale.*skipped-non-ff/);
	assert.equal(git(fixture.checkoutPath, "rev-parse", "HEAD").stdout.trim(), localHead);
});

test("refresh preserves full-history mode and fast-forwards normally", (t) => {
	const fixture = setupRepository(t);
	assert.equal(checkout(fixture.env, "--force-update").status, 0);
	git(fixture.checkoutPath, "remote", "set-url", "origin", fixture.origin);
	git(fixture.checkoutPath, "fetch", "--unshallow", "origin");
	assert.equal(git(fixture.checkoutPath, "rev-parse", "--is-shallow-repository").stdout.trim(), "false");

	for (const message of ["upstream-1", "upstream-2"]) {
		commit(fixture.source, message);
	}
	git(fixture.source, "push", "origin", "main");
	const expectedHead = git(fixture.source, "rev-parse", "HEAD").stdout.trim();

	const refreshed = checkout(fixture.env, "--force-update");
	assert.equal(refreshed.status, 0, refreshed.stderr);
	assert.equal(git(fixture.checkoutPath, "rev-parse", "HEAD").stdout.trim(), expectedHead);
	assert.equal(git(fixture.checkoutPath, "rev-parse", "--is-shallow-repository").stdout.trim(), "false");
});
