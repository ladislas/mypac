import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatSkillsForPrompt, loadSkillsFromDir } from "@earendil-works/pi-coding-agent";
import { runBlockedIssueResumeFixture } from "./test-support/lwot-resume-fixture.mjs";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const workflowOnlySkills = [
	"pac-explore",
	"pac-grill-me",
	"pac-grill-with-docs",
	"pac-session-review",
	"pac-to-issues",
	"pac-to-prd",
];
const autoInvocableCapabilitySkills = [
	"pac-caveman",
	"pac-changelog",
	"pac-commit",
	"pac-deep-read",
	"pac-diagnose",
	"pac-github",
	"pac-github-issue-create",
	"pac-handoff",
	"pac-librarian",
	"pac-pi-extension",
	"pac-pi-prompt",
	"pac-pi-skill",
	"pac-review",
	"pac-slidedeck",
	"pac-tdd",
	"pac-uv",
	"pac-zoom-out",
];
const needsEvidenceSkills = [
	"pac-improve-architecture",
	"pac-review-standards-spec",
	"pac-triage",
	"pac-upstream-checkpoints",
];
const modelVisibleSkills = [...autoInvocableCapabilitySkills, ...needsEvidenceSkills];

async function readRepoFile(...segments) {
	return readFile(path.join(repoRoot, ...segments), "utf8");
}

test("pac-llat starts with the target and expands context only when classification requires it", async () => {
	const prompt = await readRepoFile("prompts", "pac-llat.md");

	assert.match(prompt, /lightweight assessment router/i);
	assert.match(prompt, /smallest authoritative/i);
	assert.match(prompt, /do not load another workflow skill merely because/i);
	assert.match(prompt, /do not read.*README\.md.*AGENTS\.md.*CONTEXT\.md/i);
	assert.match(prompt, /issue comments/i);
	assert.match(prompt, /do not re-fetch.*issue.*fields already returned/i);
	assert.match(prompt, /after a successful structured target read.*body and metadata.*classify directly/is);
	assert.match(prompt, /before any second read.*specific materially missing fact/is);
	assert.match(prompt, /never re-read.*same content.*command.*API shape.*escaped.*raw/is);
	assert.match(prompt, /gh issue view.*--json.*body.*gh api.*--jq \.body/is);
	assert.match(prompt, /follow-up reads.*missing fact.*changed.*post-transition/is);
	assert.doesNotMatch(prompt, /perform one targeted follow-up read/i);
	assert.match(prompt, /\*\*Provided arguments\*\*: \$@\s*$/);
});

test("pac-lwot gates execution before loading implementation context", async () => {
	const prompt = await readRepoFile("prompts", "pac-lwot.md");
	const targetResolution = prompt.search(/resolve the target/i);
	const executionGate = prompt.search(/execution (?:is|required|necessity)/i);
	const repositoryPreparation = prompt.search(/repository (?:rules|state|context)/i);

	assert.ok(targetResolution >= 0, "target resolution should be explicit");
	assert.ok(executionGate > targetResolution, "execution gate should follow target resolution");
	assert.ok(repositoryPreparation > executionGate, "repository preparation should follow the execution gate");
	assert.match(prompt, /smallest authoritative artifact/i);
	assert.match(prompt, /GitHub issue.*initial structured read.*body.*execution-gate metadata/is);
	assert.match(prompt, /fields already present.*must not be re-fetched/is);
	assert.match(prompt, /before any second read.*specific materially missing fact/is);
	assert.match(prompt, /follow-up reads.*missing.*stale.*state transition/is);
	assert.match(prompt, /no (?:work|execution).*stop/i);
	assert.match(prompt, /do not.*README\.md.*(?:startup|by default)/i);
	assert.match(prompt, /repository-specific.*rules.*before mutation/i);
	assert.match(prompt, /actual default.*protected branch.*before.*implementation mutation/is);
	assert.match(prompt, /reuse.*repository.*policy.*already available/i);
	assert.match(prompt, /policy.*unresolved.*only.*targeted read/is);
	assert.match(prompt, /implementation must not proceed.*actual default branch/i);
	assert.match(prompt, /may strengthen but not weaken.*default-branch floor/i);
	assert.match(prompt, /repository.*user policy.*branch naming.*branch type.*base strategy.*additional protected branches.*already-active non-protected branch/is);
	assert.doesNotMatch(prompt, /deferring whether a work branch is required/i);
	assert.match(prompt, /implementation skills.*only after.*execution/i);
	assert.match(prompt, /carry.*issue identity.*without deciding.*clos/i);
	assert.match(prompt, /(?:pac-commit.*commit preparation.*relevant|commit preparation.*relevant.*pac-commit)/is);
	assert.match(prompt, /may.*inspect.*verification.*staging.*hooks/is);
	assert.match(prompt, /before.*git commit.*coherent slice.*(?:proportionate verification.*complete|strongest available evidence.*gathered).*commit creation.*allowed/is);
	assert.match(prompt, /exact.*(?:skill )?read order.*efficiency goal.*not.*(?:safety|correctness) guarantee/is);
	assert.doesNotMatch(prompt, /pac-commit.*only when.*verified/is);
	assert.match(prompt, /do not infer.*push.*merge.*authorization/is);
	assert.doesNotMatch(prompt, /do not work directly on `main`/i);
});

test("pac-lwot prompt contract requires resume re-grounding and pre-commit closure", async () => {
	const prompt = await readRepoFile("prompts", "pac-lwot.md");
	const resumeHandling = prompt.search(/resume or material state transition/i);
	const reGrounding = prompt.search(/re-ground.*authoritative target/i);
	const implementationContinuation = prompt.search(/before (?:continuing|resuming) implementation/i);
	const closureCheck = prompt.search(/target-to-slice closure check/i);
	const commitPreparation = prompt.search(/commit preparation becomes relevant/i);

	assert.ok(resumeHandling >= 0, "resume handling should be explicit");
	assert.ok(reGrounding > resumeHandling, "re-grounding should follow targeted transition verification");
	assert.ok(implementationContinuation > reGrounding, "the target contract should be restored before implementation continues");
	assert.ok(closureCheck > implementationContinuation, "closure should be checked after implementation");
	assert.ok(closureCheck < commitPreparation, "closure should be checked before commit preparation");
	assert.match(prompt, /blocker.*changed.*verify only.*changed.*state/is);
	assert.match(prompt, /reuse.*already-resolved.*authoritative target/is);
	assert.match(prompt, /re-grounding.*not.*re-fetching/is);
	assert.match(prompt, /requirements.*acceptance criteria.*non-goals/is);
	assert.match(prompt, /do not introduce.*cannot be traced.*target.*decision.*user instruction/is);
	assert.match(prompt, /applicable requirements.*satisfied.*explicitly unresolved/is);
	assert.match(prompt, /omitted.*requirement/is);
	assert.match(prompt, /material additions.*outside.*target.*surface/is);
});

test("pac-lwot blocked-resume fixture preserves target scope and surfaces closure drift before commit preparation", () => {
	const authoritativeContract = {
		requirements: [
			{ id: "preserve-scope", text: "Reuse the original issue contract after resume" },
			{ id: "check-closure", text: "Check target-to-slice closure before commit preparation" },
		],
		nonGoals: ["Refactor unrelated workflow routing"],
	};
	let bodyFetches = 0;
	let blockerStateFetches = 0;

	const result = runBlockedIssueResumeFixture({
		readIssue: () => {
			bodyFetches += 1;
			return { contract: authoritativeContract, blocker: "waiting-for-policy" };
		},
		readBlockerState: () => {
			blockerStateFetches += 1;
			return "resolved";
		},
		candidateSlice: {
			satisfiedRequirementIds: ["preserve-scope"],
			changes: [
				{ description: "Restore the original contract", requirementId: "preserve-scope", material: true },
				{ description: "Refactor unrelated workflow routing", requirementId: null, material: true },
			],
		},
	});

	assert.equal(bodyFetches, 1, "resume should reuse the complete issue body read");
	assert.equal(blockerStateFetches, 1, "resume should verify only the changed blocker state");
	assert.deepEqual(result.blockerTransition, { from: "waiting-for-policy", to: "resolved" });
	assert.deepEqual(result.executionContract, authoritativeContract);
	assert.deepEqual(result.closure.omittedRequirements, [authoritativeContract.requirements[1]]);
	assert.deepEqual(result.closure.unrelatedAdditions, ["Refactor unrelated workflow routing"]);
	assert.ok(result.events.indexOf("closure-drift-surfaced") < result.events.indexOf("commit-preparation-blocked"));
});

test("workflow-only skills stay out of model context but explicit prompts still load them", async () => {
	const { skills, diagnostics } = loadSkillsFromDir({
		dir: path.join(repoRoot, "skills"),
		source: "workflow-routing-test",
	});
	assert.deepEqual(diagnostics, []);
	const skillsByName = new Map(skills.map((skill) => [skill.name, skill]));
	const modelPrompt = formatSkillsForPrompt(skills);

	for (const name of workflowOnlySkills) {
		assert.equal(skillsByName.get(name)?.disableModelInvocation, true, `${name} should be workflow-only`);
		assert.doesNotMatch(modelPrompt, new RegExp(`<name>${name}</name>`));

		const explicitPrompt = await readRepoFile("prompts", `${name}.md`);
		assert.match(explicitPrompt, new RegExp(`skills/${name}/SKILL\\.md`));
	}
});

test("the intended model-visible skill set is an explicit metadata contract", () => {
	const { skills, diagnostics } = loadSkillsFromDir({
		dir: path.join(repoRoot, "skills"),
		source: "workflow-routing-test",
	});
	assert.deepEqual(diagnostics, []);

	const discoveredNames = skills.map((skill) => skill.name).sort();
	const classifiedNames = [...workflowOnlySkills, ...modelVisibleSkills].sort();
	assert.deepEqual(discoveredNames, classifiedNames, "all package skills should have an invocation classification");

	const visibleNames = skills
		.filter((skill) => !skill.disableModelInvocation)
		.map((skill) => skill.name)
		.sort();
	assert.deepEqual(visibleNames, modelVisibleSkills.toSorted());

	const modelPrompt = formatSkillsForPrompt(skills);
	for (const name of modelVisibleSkills) {
		assert.match(modelPrompt, new RegExp(`<name>${name}</name>`), `${name} should remain model-visible`);
	}
});

test("pac-improve-architecture advertises architecture work rather than generic exploration", () => {
	const { skills } = loadSkillsFromDir({
		dir: path.join(repoRoot, "skills"),
		source: "workflow-routing-test",
	});
	const architecture = skills.find((skill) => skill.name === "pac-improve-architecture");

	assert.ok(architecture);
	assert.match(architecture.description, /explicitly asks for codebase architecture/i);
	assert.match(architecture.description, /not for general product (?:ideation|exploration)/i);
});

test("pac-github remains available for non-trivial GitHub operations without claiming simple reads", async () => {
	const { skills } = loadSkillsFromDir({
		dir: path.join(repoRoot, "skills"),
		source: "workflow-routing-test",
	});
	const github = skills.find((skill) => skill.name === "pac-github");

	assert.ok(github);
	assert.equal(github.disableModelInvocation, false);
	assert.match(github.description, /non-trivial GitHub operations/i);
	assert.doesNotMatch(github.description, /working with GitHub issues, pull requests/i);
});

test("durable docs describe pac-llat routing and model-invocation visibility", async () => {
	const [readme, catalog] = await Promise.all([
		readRepoFile("README.md"),
		readRepoFile("docs", "catalog.md"),
	]);

	assert.match(readme, /pac-llat.*classify a target and route it to the appropriate workflow/i);
	assert.match(catalog, /pac-llat.*classify a target and route it to the appropriate workflow/i);
	assert.match(catalog, /disable-model-invocation/i);
	assert.match(catalog, /workflow-only skills/i);
});

test("pac-pi-extension verifies pinned APIs through progressive documentation reads", async () => {
	const skill = await readRepoFile("skills", "pac-pi-extension", "SKILL.md");
	const inspectExistingCode = skill.search(/inspect the existing extension implementation/i);
	const identifyApiSurface = skill.search(/identify the concrete Pi API.*surface/i);
	const readTargetedDocs = skill.search(/targeted searches.*specific sections.*specific examples/i);

	assert.ok(inspectExistingCode >= 0, "existing extension code inspection should be explicit");
	assert.ok(identifyApiSurface > inspectExistingCode, "API identification should follow local inspection");
	assert.ok(readTargetedDocs > identifyApiSurface, "targeted documentation should follow API identification");
	assert.match(skill, /installed.*pinned.*authoritative/i);
	assert.match(skill, /matching line numbers.*narrow surrounding range/i);
	assert.match(skill, /do not begin.*entire documentation file/i);
	assert.match(skill, /sequential ranges.*whole-document read/i);
	assert.match(skill, /before.*whole-file fallback.*state.*unresolved API question.*targeted evidence.*failed/i);
	assert.match(skill, /established local.*TUI.*pattern.*does not.*broad TUI documentation/i);
	assert.match(skill, /TUI documentation only when.*touches TUI behavior/i);
	assert.match(skill, /expand.*broader documentation only when.*targeted.*insufficient/i);
	assert.match(skill, /do not rely on memory/i);
	assert.match(skill, /upstream `pi-mono`.*only.*upgrade/i);
});

test("pac-upstream-checkpoints skill resolves narrow registry scope before expanding references", async () => {
	const [skill, watchInventory] = await Promise.all([
		readRepoFile("skills", "pac-upstream-checkpoints", "SKILL.md"),
		readRepoFile("skills", "pac-upstream-checkpoints", "WATCH_INVENTORY.md"),
	]);
	const resolveScope = skill.search(/resolve (?:the )?requested registry scope/i);
	const notesBranch = skill.search(/free-form notes/i);
	const targetedExtraction = skill.search(/registry-scope\.mjs.*<id>/i);
	const fullRegistry = skill.search(/only then expand to the full registry/i);
	const model = skill.search(/load `MODEL\.md`/i);
	const publicationDecision = skill.search(/checkpoint issue is needed/i);
	const publicationTemplate = skill.search(/CHECKPOINT_ISSUE_TEMPLATE\.md/i);

	assert.ok(resolveScope >= 0, "scope resolution should be explicit");
	assert.ok(notesBranch > resolveScope, "free-form notes should have an explicit routing branch");
	assert.ok(targetedExtraction > notesBranch, "notes routing should resolve before exact-ID extraction");
	assert.ok(fullRegistry > targetedExtraction, "full-registry fallback should follow targeted extraction");
	assert.ok(model > targetedExtraction, "model loading should not precede narrow extraction");
	assert.ok(publicationDecision >= 0, "publication should have an explicit decision gate");
	assert.ok(publicationTemplate > publicationDecision, "the issue template should load only after publication is needed");
	assert.match(skill, /local-first/i);
	assert.match(skill, /sync_policy/i);
	assert.match(skill, /last_reviewed/i);
	assert.match(skill, /commit history before.*raw.*diff/is);
	assert.match(skill, /known_divergence.*do_not_chase/is);
	assert.match(skill, /human confirmation.*baseline/i);
	assert.match(skill, /do not implement upstream changes/i);
	assert.match(skill, /watch-source ID:.*WATCH_INVENTORY\.md/i);
	assert.match(skill, /extract.*explicit.*stable ID.*notes/i);
	assert.match(skill, /targeted literal searches.*stable registry fields/i);
	assert.match(skill, /zero or multiple candidates.*expand only.*concrete unresolved/is);
	assert.match(skill, /never.*treat.*notes.*all/i);
	assert.match(skill, /never.*pass.*entire note.*exact-ID extractor/i);
	assert.match(watchInventory, /every uncovered upstream artifact path/i);
	assert.match(watchInventory, /never replace the complete list.*such as.*etc/is);
	assert.match(watchInventory, /initial baseline.*currently uncovered.*not `new`/is);
	assert.match(watchInventory, /new.*moved.*removed.*still uncovered/is);
	assert.match(watchInventory, /never assumes adoption.*never triggers automatic upstream implementation/is);
});

test("pac-upstream-checkpoints prompt routes narrow scope before full registry and model access", async () => {
	const prompt = await readRepoFile("prompts", "pac-upstream-checkpoints.md");
	const resolveScope = prompt.search(/resolve (?:the )?requested registry scope/i);
	const notesBranch = prompt.search(/free-form notes/i);
	const targetedExtraction = prompt.search(/registry-scope\.mjs.*<id>/i);
	const fullRegistry = prompt.search(/full registry/i);
	const model = prompt.search(/MODEL\.md/i);

	assert.ok(resolveScope >= 0, "prompt should resolve scope explicitly");
	assert.ok(notesBranch > resolveScope, "prompt should retain free-form note routing");
	assert.ok(targetedExtraction > notesBranch, "prompt should resolve notes before exact-ID extraction");
	assert.ok(fullRegistry > targetedExtraction, "prompt should delay full registry access");
	assert.ok(model > targetedExtraction, "prompt should delay model access");
	assert.match(prompt, /all-sources?.*full registry/is);
	assert.match(prompt, /targeted.*insufficient.*full registry/is);
	assert.match(prompt, /notes.*unique.*targeted.*exact-ID extractor/is);
	assert.match(prompt, /ambiguous.*clarification.*not.*all/is);
	assert.match(prompt, /no-change.*CHECKPOINT_ISSUE_TEMPLATE\.md/is);
	assert.match(prompt, /\*\*Provided arguments\*\*: \$@\s*$/);
});

test("shared guidance requires progressive context disclosure", async () => {
	const shared = await readRepoFile("shared", "SHARED_APPEND_SYSTEM.md");

	assert.match(shared, /progressive context disclosure/i);
	assert.match(shared, /smallest authoritative artifact/i);
	assert.match(shared, /avoid redundant reads of facts already present/i);
	assert.match(shared, /materially missing, may have changed, or must be verified after a state transition/i);
	assert.match(shared, /materially needed for the next decision/i);
});

test("shared guidance prefers structured GitHub tooling over browser automation", async () => {
	const shared = await readRepoFile("shared", "SHARED_APPEND_SYSTEM.md");

	assert.match(shared, /structured, purpose-built tools over browser automation/i);
	assert.match(shared, /GitHub issues.*pull requests.*comments.*checks/i);
	assert.match(shared, /do not use `agent_browser` merely to read or inspect/i);
	assert.match(shared, /rendered browser or UI behavior/i);
	assert.match(shared, /unavailable through structured tooling/i);
});

test("shared browser guidance serves local HTML over loopback HTTP without changing screenshot behavior", async () => {
	const shared = await readRepoFile("shared", "SHARED_APPEND_SYSTEM.md");

	assert.match(shared, /locally generated HTML with `agent_browser`/i);
	assert.match(shared, /do not use a `file:\/\/` URL for interactive inspection/i);
	assert.match(shared, /temporary loopback HTTP server/i);
	assert.match(shared, /http:\/\/127\.0\.0\.1:\.\.\./i);
	assert.match(shared, /intentionally restricts follow-up inspection of local `file:\/\/` pages/i);
	assert.match(shared, /moving or copying.*retaining `file:\/\/`.*not a workaround/i);
	assert.match(shared, /do not supply a screenshot path unless the user explicitly requests a specific output path/i);
	assert.match(shared, /let `AGENT_BROWSER_SCREENSHOT_DIR` choose the destination/i);
});
