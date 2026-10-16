import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const core = await readFile(new URL("./SKILL.md", import.meta.url), "utf8");
const fixes = await readFile(new URL("./FIX_FINDINGS.md", import.meta.url), "utf8");

async function fixture(t) {
	const cwd = await mkdtemp(join(tmpdir(), "pac-review-"));
	t.after(() => rm(cwd, { recursive: true, force: true }));
	// Ignore optional stat-cache refreshes; assert index bytes without test reads rewriting them.
	const git = (...args) => execFileSync("git", args, {
		cwd, encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
	});
	const put = (name, content) => writeFile(join(cwd, name), content);
	git("init", "-b", "base");
	git("config", "user.name", "Review Test");
	git("config", "user.email", "review@example.invalid");
	await put("file.txt", "base\nunchanged\n");
	git("add", "file.txt");
	git("commit", "-m", "base");
	git("switch", "-c", "topic");
	await put("file.txt", "reviewed\nunchanged\n");
	git("commit", "-am", "topic");
	const snapshot = async () => ({
		head: git("symbolic-ref", "HEAD"),
		index: await readFile(join(cwd, ".git/index")),
		status: git("status", "--porcelain"),
		file: await readFile(join(cwd, "file.txt"), "utf8"),
	});
	return { git, put, snapshot };
}

function branchCommands() {
	return core.match(/# branch comparison\n([\s\S]*?)\n\n# commit/)[1]
		.trim().split("\n").map((line) => line.replaceAll("<base-branch>", "base")
			.replaceAll("<merge-base-sha>", "base").split(" ").slice(1));
}

for (const dirty of [false, true]) {
	test(`committed branch comparison excludes local changes (${dirty ? "dirty" : "clean"})`, async (t) => {
		const { git, put, snapshot } = await fixture(t);
		if (dirty) {
			await put("staged.txt", "unrelated staged\n");
			git("add", "staged.txt");
			await put("file.txt", "reviewed\nunrelated unstaged\n");
			await put("untracked.txt", "unrelated untracked\n");
		}
		const before = await snapshot();
		const outputs = branchCommands().map((args) => git(...args));
		assert.match(outputs.at(-1), /\+reviewed/);
		assert.doesNotMatch(outputs.at(-1), /unrelated/);
		assert.deepEqual(await snapshot(), before);
	});
}

test("PR review uses structured diff without checkout or local working-tree diff", () => {
	const commands = core.match(/# pull request\n([\s\S]*?)\n```/)[1];
	assert.match(commands, /gh pr diff <number>/);
	assert.doesNotMatch(commands, /checkout|git diff|git switch/);
	assert.match(core, /isolated worktree/);
	assert.match(core, /committed.*refs|refs.*committed/s);
});

test("dirty-worktree PR commands use the remote committed diff without local mutation", async (t) => {
	const { git, put, snapshot } = await fixture(t);
	// Model the gh boundary with committed PR refs, independently of active HEAD.
	git("switch", "base");
	await put("staged.txt", "unrelated staged\n");
	git("add", "staged.txt");
	await put("file.txt", "base\nunrelated unstaged\n");
	await put("untracked.txt", "unrelated untracked\n");
	const before = await snapshot();
	const commands = core.match(/# pull request\n([\s\S]*?)\n```/)[1].trim().split("\n");
	const outputs = commands.map((line) => {
		const [tool, ...args] = line.split(" ");
		assert.equal(tool, "gh");
		if (args[1] === "view") {
			assert.deepEqual(args, ["pr", "view", "<number>", "--json", "baseRefName,title,headRefName"]);
			return JSON.stringify({ baseRefName: "base", headRefName: "topic", title: "Review fixture" });
		}
		assert.deepEqual(args, ["pr", "diff", "<number>"]);
		return git("diff", "base...topic");
	});
	assert.match(outputs.at(-1), /\+reviewed/);
	assert.doesNotMatch(outputs.at(-1), /unrelated/);
	assert.deepEqual(await snapshot(), before);
});

test("uncommitted review inspects staged, unstaged, and untracked work without mutation", async (t) => {
	const { git, put, snapshot } = await fixture(t);
	await put("staged.txt", "staged\n");
	git("add", "staged.txt");
	await put("file.txt", "unstaged\nunchanged\n");
	await put("untracked.txt", "untracked\n");
	const before = await snapshot();
	const commands = core.match(/# uncommitted[^\n]*\n([\s\S]*?)\n\n# branch comparison/)[1];
	const outputs = commands.trim().split("\n").map((line) => git(...line.split(" ").slice(1)));
	assert.match(outputs[0], /staged.txt/);
	assert.match(outputs[1], /\+unstaged/);
	assert.match(outputs[2], /\+staged/);
	assert.match(outputs[3], /untracked.txt/);
	assert.deepEqual(await snapshot(), before);
});

test("uncommitted fix contract preserves the index and stops on ambiguous preservation", () => {
	const uncommitted = fixes.split("## Uncommitted changes\n")[1].split("## History safety")[0];
	assert.match(uncommitted, /git status --porcelain/);
	assert.match(uncommitted, /git diff --staged -- <file>/);
	assert.match(uncommitted, /git diff -- <file>/);
	assert.match(uncommitted, /partially staged/);
	assert.match(uncommitted, /index unchanged/);
	assert.match(uncommitted, /stop.*ask/is);
	assert.doesNotMatch(uncommitted, /^git (?:add|reset|restore|stash)/m);
});

test("working-tree-only fix retains partial staging and unrelated edits", async (t) => {
	const { git, put, snapshot } = await fixture(t);
	await put("file.txt", "defect\nunchanged\n");
	git("add", "file.txt");
	await put("file.txt", "defect\nuser unstaged\n");
	await put("other.txt", "user staged\n");
	git("add", "other.txt");
	await put("other.txt", "user unstaged too\n");
	const before = await snapshot();
	const staged = git("diff", "--staged");
	const other = git("diff", "--", "other.txt");
	assert.match(staged, /\+defect/);
	assert.match(git("diff", "--", "file.txt"), /\+user unstaged/);
	// Exercise the documented working-tree-only edit, not a model execution.
	await put("file.txt", before.file.replace("defect", "fixed"));
	assert.deepEqual((await snapshot()).index, before.index);
	assert.equal(git("diff", "--staged"), staged);
	assert.equal(git("diff", "--", "other.txt"), other);
	assert.match(git("diff", "--", "file.txt"), /\+fixed\n\+user unstaged/);
});

test("review skill references existing fix and Standards + Spec resources", async () => {
	const core = await readFile(new URL("./SKILL.md", import.meta.url), "utf8");
	assert.ok(core.includes("FIX_FINDINGS.md"));
	assert.ok((await readFile(new URL("./FIX_FINDINGS.md", import.meta.url), "utf8")).trim());
	assert.ok(core.includes("skills/pac-review-standards-spec/SKILL.md"));
	assert.ok((await readFile(new URL("../pac-review-standards-spec/SKILL.md", import.meta.url), "utf8")).trim());
});
