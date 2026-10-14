import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const skillUrl = new URL("./SKILL.md", import.meta.url);
const deliveryUrl = new URL("./PR_DELIVERY.md", import.meta.url);

test("commit skill references existing conditional procedures", async () => {
	const core = await readFile(skillUrl, "utf8");
	for (const reference of ["FIXUP.md", "PR_DELIVERY.md"]) {
		assert.ok(core.includes(`](${reference})`), `${reference} must be linked`);
		assert.ok((await readFile(new URL(reference, skillUrl), "utf8")).trim());
	}
});

// Intentional report-template structure only; this does not test agent reporting or publication.
test("PR delivery final report template has ordered fields and linked issue/PR identities", async () => {
	const delivery = await readFile(deliveryUrl, "utf8");
	const format = delivery.split("## Final report format\n")[1];
	assert.ok(format);
	assert.match(format, /^Status: [^\n]+\\\nIssue: [^\n]+\\\nPR: [^\n]+\\\nGit: [^\n]+\n\nResult: /m, "header must render on consecutive lines with one gap after Git");
	assert.match(format, /^Issue: \[#N\]\((<complete issue URL>)\) — \1\\$/m, "issue URL must be linked and visible");
	assert.match(format, /^PR: \[#N\]\((<complete PR URL>)\) — \1\\$/m, "PR URL must be linked and visible");
	assert.doesNotMatch(format, /<br\s*\/?\s*>/i, "do not print literal HTML breaks");

	let previousIndex = -1;
	for (const pattern of [
		/^Status: /m,
		/^Issue: \[#N\]\(<complete issue URL>\)/m,
		/^PR: \[#N\]\(<complete PR URL>\)/m,
		/^Git: <branch> → <base> · <published head SHA>/m,
		/^Result: /m,
		/^Verification: Local — .*Remote — /m,
		/^Remaining: /m,
	]) {
		const match = pattern.exec(format);
		assert.ok(match, `missing ${pattern}`);
		assert.ok(match.index > previousIndex, `${pattern} is out of order`);
		previousIndex = match.index;
	}
});
