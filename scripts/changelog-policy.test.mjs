import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("mypac policy considers meaningful changes and skips changelog noise", async () => {
  const policy = await readFile(new URL("AGENTS.md", root), "utf8");
  const changelogPolicy = policy.match(/## Changelog\n([\s\S]*?)(?=\n## |$)/)?.[1];

  assert.ok(changelogPolicy, "changelog requirement belongs in repository policy");
  assert.match(changelogPolicy, /every meaningful change to mypac.*consider.*`CHANGELOG\.md`/);
  assert.match(changelogPolicy, /user-facing/);
  assert.match(changelogPolicy, /workflow-facing/);
  assert.match(changelogPolicy, /repository-operating/);
  assert.match(changelogPolicy, /`## \[Unreleased\]`/);
  assert.match(changelogPolicy, /same coherent (work|commit)/);
  assert.match(changelogPolicy, /typo-only/);
  assert.match(changelogPolicy, /skip/i);
  assert.match(changelogPolicy, /not a requirement for downstream repositories/);
});
