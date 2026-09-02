import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { unzipSync } from "fflate";
import { exportChatgptSkills } from "./export-chatgpt-skills.ts";

const repository = new URL("../", import.meta.url);
const output = new URL("../dist/chatgpt-skills/", import.meta.url);
const skillNames = ["pac-deep-read", "pac-explore", "pac-grill-me", "pac-slidedeck", "pac-zoom-out"];

function exportSkills() {
	const result = spawnSync("npm", ["run", "export:chatgpt-skills"], {
		cwd: repository,
		encoding: "utf8",
	});
	assert.equal(result.status, 0, result.stderr || result.stdout);
}

async function archiveHashes() {
	return Promise.all(
		skillNames.map(async (name) => {
			const bytes = await readFile(new URL(`packages/${name}.zip`, output));
			return createHash("sha256").update(bytes).digest("hex");
		}),
	);
}

test("export command produces five deterministic canonical skill packages", async (t) => {
	await rm(output, { recursive: true, force: true });
	t.after(() => rm(output, { recursive: true, force: true }));

	exportSkills();
	for (const name of skillNames) {
		assert.deepEqual(await readdir(new URL(`${name}/`, output)), ["SKILL.md"]);
		const archive = await readFile(new URL(`packages/${name}.zip`, output));
		assert.deepEqual(Object.keys(unzipSync(archive)), ["SKILL.md"]);
	}
	assert.deepEqual((await readdir(new URL("packages/", output))).sort(), skillNames.map((name) => `${name}.zip`));

	for (const name of ["pac-explore", "pac-grill-me"]) {
		assert.match(await readFile(new URL(`../skills/${name}/SKILL.md`, import.meta.url), "utf8"), /disable-model-invocation:\s*true/);
		assert.doesNotMatch(await readFile(new URL(`${name}/SKILL.md`, output), "utf8"), /disable-model-invocation/);
	}
	assert.equal(
		await readFile(new URL("pac-deep-read/SKILL.md", output), "utf8"),
		await readFile(new URL("../skills/pac-deep-read/SKILL.md", import.meta.url), "utf8"),
	);
	assert.equal(
		await readFile(new URL("pac-slidedeck/SKILL.md", output), "utf8"),
		await readFile(new URL("../skills/pac-slidedeck/SKILL.md", import.meta.url), "utf8"),
	);

	const firstHashes = await archiveHashes();
	exportSkills();
	assert.deepEqual(await archiveHashes(), firstHashes);
});

async function fixture(skillSource, manifest = { skills: ["portable-skill"] }, resources = {}) {
	const directory = await mkdtemp(join(tmpdir(), "mypac-chatgpt-export-"));
	const skillDirectory = join(directory, "skills", "portable-skill");
	await mkdir(skillDirectory, { recursive: true });
	await writeFile(join(skillDirectory, "SKILL.md"), skillSource);
	for (const [path, content] of Object.entries(resources)) {
		await mkdir(dirname(join(skillDirectory, path)), { recursive: true });
		await writeFile(join(skillDirectory, path), content);
	}
	await writeFile(join(directory, "chatgpt-skills.json"), `${JSON.stringify(manifest)}\n`);
	return directory;
}

const validSkill = `---
name: portable-skill
description: A portable test skill. Use when testing exports.
license: MIT
metadata:
  author: mypac
---

# Portable skill
`;

test("export fails closed on incompatible metadata and references", async (t) => {
	const cases = [
		[validSkill.replace("license: MIT", "unexpected: true\nlicense: MIT"), /unsupported frontmatter field: unexpected/],
		[validSkill.replace("author: mypac", "author: 7"), /metadata keys and values must be strings/],
		[`${validSkill}\nRun /pac-lwot next.\n`, /Pi slash-command reference/],
		[`${validSkill}\nSee [outside](..\/outside.md).\n`, /reference escapes the skill package/],
		[`${validSkill}\nSee [missing](references\/missing.md).\n`, /referenced resource is not packaged/],
	];

	for (const [source, expected] of cases) {
		const directory = await fixture(source);
		t.after(() => rm(directory, { recursive: true, force: true }));
		await assert.rejects(exportChatgptSkills({ repository: directory }), expected);
		await assert.rejects(readdir(join(directory, "dist", "chatgpt-skills")), { code: "ENOENT" });
	}
});

test("plain supported-directory references must resolve to packaged resources", async (t) => {
	const missingDirectory = await fixture(`${validSkill}\nRun the extraction script:\nscripts/missing.py\n`);
	t.after(() => rm(missingDirectory, { recursive: true, force: true }));
	await assert.rejects(exportChatgptSkills({ repository: missingDirectory }), /referenced resource is not packaged: scripts\/missing\.py/);

	const packagedDirectory = await fixture(
		`${validSkill}\nRun the extraction script:\nscripts/extract.py\n`,
		{ skills: ["portable-skill"] },
		{ "scripts/extract.py": "print('ok')\n" },
	);
	t.after(() => rm(packagedDirectory, { recursive: true, force: true }));
	await exportChatgptSkills({ repository: packagedDirectory });
	assert.equal(await readFile(join(packagedDirectory, "dist", "chatgpt-skills", "portable-skill", "scripts", "extract.py"), "utf8"), "print('ok')\n");
});

test("known Pi-only workflow cannot enter the export manifest", async (t) => {
	const directory = await mkdtemp(join(tmpdir(), "mypac-chatgpt-pi-only-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await writeFile(join(directory, "manifest.json"), '{"skills":["pac-to-prd"]}\n');
	await assert.rejects(
		exportChatgptSkills({ repository: new URL("../", import.meta.url).pathname, manifest: join(directory, "manifest.json"), output: join(directory, "output") }),
		/Pi-only runtime/,
	);
});
