import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildFileEntries } from "./git.ts";

function createRepository(t) {
	const cwd = realpathSync(mkdtempSync(path.join(os.tmpdir(), "pac-files-git-")));
	t.after(() => rmSync(cwd, { recursive: true, force: true }));
	const pi = {
		async exec(command, args, options) {
			const result = spawnSync(command, args, { ...options, encoding: "utf8" });
			assert.ifError(result.error);
			return { code: result.status, stdout: result.stdout, stderr: result.stderr };
		},
	};
	const git = (...args) => {
		const result = spawnSync("git", args, { cwd, encoding: "utf8" });
		assert.ifError(result.error);
		assert.equal(result.status, 0, result.stderr);
	};
	const write = (name, content) => writeFileSync(path.join(cwd, name), content);
	const entries = async () => {
		const { files } = await buildFileEntries(pi, {
			cwd,
			sessionManager: { getBranch: () => [] },
		});
		return Object.fromEntries(files.map((file) => [
			path.relative(cwd, file.canonicalPath),
			{ status: file.status, exists: file.exists, isTracked: file.isTracked },
		]));
	};
	git("init", "--quiet");
	git("config", "user.name", "Files test");
	git("config", "user.email", "files@example.com");
	git("config", "commit.gpgsign", "false");
	git("config", "core.hooksPath", path.join(cwd, "no-hooks"));
	git("config", "status.renames", "true");
	return { cwd, git, write, entries };
}

test("/files keeps copy destinations separate from modified sources when Git emits copies", async (t) => {
	const { git, write, entries } = createRepository(t);
	const content = "one\ntwo\nthree\nfour\nfive\n";
	write("source file.txt", content);
	git("add", ".");
	git("commit", "--quiet", "-m", "baseline");
	git("config", "status.renames", "copies");
	write("copied file.txt", content);
	write("source file.txt", `${content}six\n`);
	git("add", ".");

	assert.deepEqual(await entries(), {
		"copied file.txt": { status: "C", exists: true, isTracked: true },
		"source file.txt": { status: "M", exists: true, isTracked: true },
	});
});

for (const staged of [true, false]) {
	test(`/files uses ${staged ? "staged" : "worktree"} rename destinations without losing subsequent status entries`, async (t) => {
		const { cwd, git, write, entries } = createRepository(t);
		const source = "old name.txt";
		const destination = 'new \tname\n"quoted".txt';
		write(source, "rename content\n");
		write("modified file.txt", "original\n");
		write("deleted file.txt", "deleted\n");
		git("add", ".");
		git("commit", "--quiet", "-m", "baseline");
		if (staged) {
			git("mv", source, destination);
		} else {
			renameSync(path.join(cwd, source), path.join(cwd, destination));
			git("add", "-N", "--", destination);
		}
		write("added file.txt", "added\n");
		git("add", "--", "added file.txt");
		write("modified file.txt", "changed\n");
		rmSync(path.join(cwd, "deleted file.txt"));
		write("untracked file.txt", "untracked\n");

		assert.deepEqual(await entries(), {
			[destination]: { status: "R", exists: true, isTracked: true },
			"added file.txt": { status: "A", exists: true, isTracked: true },
			"modified file.txt": { status: "M", exists: true, isTracked: true },
			"deleted file.txt": { status: "D", exists: false, isTracked: true },
			"untracked file.txt": { status: "??", exists: true, isTracked: false },
		});
	});
}
