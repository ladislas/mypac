import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { expandMatrix, parseManifest } from "../../scripts/pac-eval.ts";

const execFileAsync = promisify(execFile);
const fixtureDirectory = dirname(new URL(import.meta.url).pathname);

test("MVP smoke manifest defines exactly one deterministic scenario across two profiles", async () => {
  const manifest = parseManifest(
    JSON.parse(await readFile(join(fixtureDirectory, "manifest.json"), "utf8")),
    fixtureDirectory,
  );

  assert.deepEqual(
    expandMatrix(manifest).map(({ scenario, profile }) => ({
      scenario: scenario.id,
      profile: profile.id,
      model: profile.model,
      thinking: profile.thinking,
    })),
    [
      {
        scenario: "exact-repository-edit",
        profile: "gpt-5.6-luna-low",
        model: "openai-codex/gpt-5.6-luna",
        thinking: "low",
      },
      {
        scenario: "exact-repository-edit",
        profile: "gpt-5.4-medium",
        model: "openai-codex/gpt-5.4",
        thinking: "medium",
      },
    ],
  );
});

test("MVP smoke verifier accepts only the exact requested repository edit", async () => {
  const repository = await mkdtemp(join(tmpdir(), "pac-eval-mvp-smoke-"));
  await execFileAsync("git", ["init", "-q"], { cwd: repository });
  const outputPath = join(repository, "evaluations", "mvp-smoke", "workspace", "result.txt");
  const verify = () => execFileAsync(process.execPath, [join(fixtureDirectory, "verify.mjs")], { cwd: repository });

  await assert.rejects(verify());
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, "wrong\n");
  await assert.rejects(verify());
  await writeFile(outputPath, "Pi evaluation harness smoke passed.\n");
  await assert.doesNotReject(verify());
});
