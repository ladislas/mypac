import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..");
const tasksDir = join(rootDir, ".mise", "tasks");
const depsSource = join(tasksDir, "deps.sh");

function writeCommand(bin, name, body) {
	const path = join(bin, name);
	writeFileSync(path, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
	chmodSync(path, 0o755);
}

test("ChatGPT mise tasks share incremental checkout dependency setup with bootstrap", () => {
	const depsTask = readFileSync(depsSource, "utf8");
	const exportTask = readFileSync(join(tasksDir, "chatgpt-skills", "export.sh"), "utf8");
	const validateTask = readFileSync(join(tasksDir, "chatgpt-skills", "validate.sh"), "utf8");
	const bootstrapTask = readFileSync(join(tasksDir, "bootstrap.sh"), "utf8");

	assert.match(depsTask, /^#MISE sources=\["package\.json", "package-lock\.json"\]$/m);
	assert.match(depsTask, /^#MISE outputs=\["node_modules\/\.package-lock\.json"\]$/m);
	assert.match(depsTask, /^npm ci$/m);
	assert.match(exportTask, /^#MISE depends=\["deps"\]$/m);
	assert.match(validateTask, /^#MISE depends=\["deps"\]$/m);
	assert.match(exportTask, /^npm run export:chatgpt-skills$/m);
	assert.match(validateTask, /^npm run validate:chatgpt-skills:reference$/m);
	assert.match(bootstrapTask, /^mise run deps$/m);
	assert.doesNotMatch(bootstrapTask, /^npm ci$/m);
});

test("checkout dependency task runs npm ci from the repository root", (t) => {
	const root = mkdtempSync(join(tmpdir(), "mypac-deps-task-"));
	const bin = join(root, "bin");
	const taskDir = join(root, ".mise", "tasks");
	const log = join(root, "commands.log");
	mkdirSync(bin);
	mkdirSync(taskDir, { recursive: true });
	cpSync(depsSource, join(taskDir, "deps.sh"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	writeCommand(bin, "npm", `printf '%s\\t%s\\n' "$PWD" "$*" > ${JSON.stringify(log)}`);

	const result = spawnSync("/bin/bash", [join(taskDir, "deps.sh")], {
		cwd: tmpdir(),
		env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` },
		encoding: "utf8",
	});

	assert.equal(result.status, 0, result.stderr);
	assert.equal(readFileSync(log, "utf8"), `${root}\tci\n`);
});
