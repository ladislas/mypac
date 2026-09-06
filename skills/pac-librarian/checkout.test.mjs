import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import "./checkout.integration.mjs";

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

function setupFakeGit(t, options) {
	const { isShallow, failShallowDetection = false, hasShallowFile = false } = options;
	const dir = mkdtempSync(join(tmpdir(), "pac-librarian-test-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));

	const bin = join(dir, "bin");
	const cacheRoot = join(dir, "cache");
	const checkoutPath = join(cacheRoot, "github.com", "owner", "repo");
	const gitDir = join(checkoutPath, ".git");
	const logPath = join(dir, "git.log");

	mkdirSync(bin, { recursive: true });
	mkdirSync(gitDir, { recursive: true });
	writeFileSync(join(gitDir, "fake-origin"), "https://github.com/owner/repo.git");
	writeFileSync(join(gitDir, "fake-is-shallow"), `${isShallow}\n`);
	writeFileSync(join(gitDir, "fake-fail-shallow-detection"), `${failShallowDetection}\n`);
	if (hasShallowFile) writeFileSync(join(gitDir, "shallow"), "fake-shallow-boundary\n");

	writeFileSync(join(bin, "git"), String.raw`#!/usr/bin/env bash
set -euo pipefail
log=__LOG_PATH__
printf '%s\n' "$*" >> "$log"
workdir=""
if [[ "$1" == "-C" ]]; then
  workdir="$2"
  shift 2
fi
cmd="$1"
shift || true
case "$cmd" in
  clone)
    checkout_path="$1"
    for arg in "$@"; do checkout_path="$arg"; done
    mkdir -p "$checkout_path/.git"
    printf '%s\n' "https://github.com/owner/repo.git" > "$checkout_path/.git/fake-origin"
    printf '%s\n' true > "$checkout_path/.git/fake-is-shallow"
    ;;
  remote)
    subcmd="$1"; shift
    case "$subcmd" in
      get-url)
        if [[ -f "$workdir/.git/fake-origin" ]]; then cat "$workdir/.git/fake-origin"; else exit 1; fi
        ;;
      add|set-url)
        printf '%s\n' "$2" > "$workdir/.git/fake-origin"
        ;;
    esac
    ;;
  fetch)
    ;;
  symbolic-ref)
    printf '%s\n' main
    ;;
  rev-parse)
    if [[ "$*" == "--is-shallow-repository" ]]; then
      if [[ "$(cat "$workdir/.git/fake-fail-shallow-detection")" == "true" ]]; then exit 1; fi
      cat "$workdir/.git/fake-is-shallow"
    elif [[ "$*" == "--abbrev-ref --symbolic-full-name @{u}" ]]; then
      printf '%s\n' origin/main
    else
      printf '%s\n' fake-ref
    fi
    ;;
  status)
    ;;
  merge)
    ;;
  *)
    echo "unexpected git command: $cmd $*" >&2
    exit 99
    ;;
esac
`.replace("__LOG_PATH__", JSON.stringify(logPath)), { mode: 0o755 });

	return { dir, bin, cacheRoot, logPath };
}

function runCheckoutWithFakeGit(t, options) {
	const fixture = setupFakeGit(t, options);
	const result = run("bash", [checkoutScript, "owner/repo", "--force-update", "--path-only"], {
		env: {
			...process.env,
			PATH: `${fixture.bin}:${process.env.PATH}`,
			LIBRARIAN_CACHE_ROOT: fixture.cacheRoot,
		},
	});

	return { ...fixture, result };
}

test("force update preserves full-history checkouts", (t) => {
	const { logPath, result } = runCheckoutWithFakeGit(t, { isShallow: false });

	assert.equal(result.status, 0);
	const log = run("cat", [logPath]).stdout;
	assert.match(log, /fetch --prune --tags origin/);
	assert.doesNotMatch(log, /fetch --deepen=1 --prune --tags origin/);
});

test("force update deepens shallow fetches enough to preserve ancestry", (t) => {
	const { logPath, result } = runCheckoutWithFakeGit(t, { isShallow: true });

	assert.equal(result.status, 0);
	const log = run("cat", [logPath]).stdout;
	assert.match(log, /fetch --deepen=1 --prune --tags origin/);
});

test("force update treats unknown shallow state without shallow file as full history", (t) => {
	const { logPath, result } = runCheckoutWithFakeGit(t, { isShallow: false, failShallowDetection: true });

	assert.equal(result.status, 0);
	const log = run("cat", [logPath]).stdout;
	assert.match(log, /fetch --prune --tags origin/);
	assert.doesNotMatch(log, /fetch --deepen=1 --prune --tags origin/);
});

test("force update falls back to shallow file when shallow detection is unavailable", (t) => {
	const { logPath, result } = runCheckoutWithFakeGit(t, {
		isShallow: false,
		failShallowDetection: true,
		hasShallowFile: true,
	});

	assert.equal(result.status, 0);
	const log = run("cat", [logPath]).stdout;
	assert.match(log, /fetch --deepen=1 --prune --tags origin/);
});
