import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function readRepoFile(path) {
	return readFile(new URL(path, root), "utf8");
}

test("CONTEXT.md defines compositional behavior ownership", async () => {
	const context = await readRepoFile("CONTEXT.md");

	assert.match(context, /behavior ownership is compositional, not a linear precedence stack/i);
	assert.match(context, /shared guidance.*safety floors/is);
	assert.match(context, /repository policy.*commit-message conventions.*branch naming.*verification commands.*merge strategy/is);
	assert.match(context, /skills.*task-specific procedure/is);
	assert.match(context, /prompts.*entrypoints.*carry target identity.*load relevant procedure.*without independently deciding.*policy.*workflow outcomes/is);
	assert.match(context, /tooling.*hooks.*extensions.*deterministic enforcement.*runtime behavior/is);
	assert.match(context, /conditional reference files.*large or uncommon workflow branches/is);
	assert.match(context, /may strengthen.*cannot weaken/is);
	assert.match(context, /contradictory.*stop.*request resolution/is);
});

test("shared guidance recovers a successful read obscured by an opaque CCR marker without broad duplicate reads", async () => {
	const shared = await readRepoFile("shared/SHARED_APPEND_SYSTEM.md");
	assert.match(shared, /<<ccr:/i);
	assert.match(shared, /presentation failure/i);
	assert.match(shared, /not.*(?:source|artifact).*missing/i);
	assert.match(shared, /do not repeatedly re-(?:read|fetch).*same.*representation/i);
	assert.match(shared, /do not.*ask.*paste.*already fetched/i);
	assert.match(shared, /bounded|chunked/i);
	assert.match(shared, /persisted|local output/i);
	assert.match(shared, /outside.*(?:failure|case).*progressive-context|normal.*progressive-context/i);
});
test("shared guidance keeps universal repository safety floors without prescribing local policy", async () => {
	const shared = await readRepoFile("shared/SHARED_APPEND_SYSTEM.md");

	assert.match(shared, /inspect repository state.*actual default branch.*before the first implementation mutation/is);
	assert.match(shared, /do not (?:make )?implementation changes.*actual default branch/i);
	assert.match(shared, /preserve unrelated.*explicit.*scoped staging/is);
	assert.match(shared, /whether Pi creates commits.*separate.*commit quality/is);
	assert.match(shared, /when Pi creates commits.*coherent.*proportionate verification/is);
	assert.match(shared, /explicit authorization.*push.*merge.*force-push.*history rewrite/is);
	assert.match(shared, /repository policy may strengthen.*but (?:may )?not weaken/is);

	assert.doesNotMatch(shared, /gitmoji|conventional commits|closes #|npm (?:test|run)|merge strategy/i);
});
