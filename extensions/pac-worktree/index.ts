import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import {
	buildIssueBranch, findWorktreeByBranch, formatBranchWorktreeSummary, formatCurrentWorktreeStatus,
	formatIssueWorktreeSummary, formatWorktreeList, matchesIssueBranch, parseIssueTarget, parseWorktrunkList,
	type BranchType,
} from "./helpers.ts";

type IssueMetadata = { number: number; title: string; url: string; labels: { name: string }[] };
type CommandResult<T> = { ok: true; value: T } | { ok: false; error: string };
const usage = "Usage: /pac-worktree <issue-number-or-url> [--type feature|bugfix|release], branch <name>, list, status";
const examples = ["550", "https://github.com/ladislas/mypac/issues/550", "branch ", "list", "status"];

export default function pacWorktreeExtension(pi: ExtensionAPI): void {
	pi.registerCommand("pac-worktree", {
		description: "Create/reuse issue worktrees and open parallel Pi sessions",
		getArgumentCompletions: (prefix) => {
			const options = /^\S+ --type /.test(prefix)
				? ["feature", "bugfix", "release"].map((type) => `${prefix.split(" --type ")[0]} --type ${type}`)
				: [...examples, ...(/^\S+\s/.test(prefix) ? [`${prefix.trim().split(/\s/)[0]} --type `] : [])];
			const items = options.filter((value) => value.startsWith(prefix)).map((value) => ({ value, label: value }));
			return items.length ? items : null;
		},
		handler: async (args, ctx) => {
			try {
				await runCommand(pi, args, ctx);
			} catch (error) {
				ctx.ui.notify(`Worktree operation failed: ${error instanceof Error ? error.message : String(error)}`, "error");
			}
		},
	});
}

async function runCommand(pi: ExtensionAPI, args: string, ctx: ExtensionCommandContext): Promise<void> {
	let input = args.trim();
	if (!input) {
		if (!ctx.hasUI) { ctx.ui.notify(usage, "info"); return; }
		const choice = await ctx.ui.select("Pac worktree", ["Issue", "Branch", "List", "Status"]);
		if (!choice) return;
		if (choice === "Issue" || choice === "Branch") {
			const value = await ctx.ui.input(choice === "Issue" ? "Issue number or GitHub URL" : "Branch name");
			if (!value?.trim()) return;
			input = choice === "Branch" ? `branch ${value.trim()}` : value.trim();
		} else input = choice.toLowerCase();
	}
	const tokens = input.split(/\s+/);
	const command = tokens[0];
	if ((command === "list" || command === "ls" || command === "status") && tokens.length === 1) {
		const result = await listWorktrees(pi);
		ctx.ui.notify(result.ok ? (command === "status" ? formatCurrentWorktreeStatus(result.value) : formatWorktreeList(result.value)) : result.error, result.ok ? "info" : "error");
		return;
	}
	if (command === "branch") {
		if (tokens.length !== 2 || tokens[1].startsWith("-")) { ctx.ui.notify(usage, "error"); return; }
		const valid = await pi.exec("git", ["check-ref-format", "--branch", tokens[1]], { cwd: ctx.cwd });
		if (valid.code !== 0) { ctx.ui.notify("Invalid branch name.", "error"); return; }
		const result = await ensureWorktree(pi, tokens[1], (text) => ctx.ui.notify(text, "info"));
		ctx.ui.notify(result.ok ? formatBranchWorktreeSummary({ ...result.value, branch: tokens[1] }) : result.error, result.ok ? "info" : "error");
		return;
	}
	const target = parseIssueTarget(command);
	const type = tokens[2] as BranchType | undefined;
	if (!target || (tokens.length !== 1 && !(tokens.length === 3 && tokens[1] === "--type" && ["feature", "bugfix", "release"].includes(type!)))) {
		ctx.ui.notify(usage, "error"); return;
	}
	const repo = await inferRepo(pi);
	if (!repo.ok) { ctx.ui.notify(repo.error, "error"); return; }
	if (target.kind === "url" && `${target.owner}/${target.repo}`.toLowerCase() !== repo.value.toLowerCase()) {
		ctx.ui.notify(`Expected ${repo.value}; provided ${target.owner}/${target.repo}. Cross-repository issue URLs are not allowed.`, "error"); return;
	}
	ctx.ui.notify(`Reading issue #${target.number} from ${repo.value}...`, "info");
	const issue = await fetchIssue(pi, repo.value, target.number);
	if (!issue.ok) { ctx.ui.notify(issue.error, "error"); return; }
	const worktrees = await listWorktrees(pi);
	if (!worktrees.ok) { ctx.ui.notify(worktrees.error, "error"); return; }
	const refs = await pi.exec("git", ["for-each-ref", "--format=%(refname:short)", "refs/heads/"], { cwd: ctx.cwd });
	if (refs.code !== 0) { ctx.ui.notify(formatExecError("Could not inspect issue branches", refs), "error"); return; }
	const matches = [...new Set([
		...worktrees.value.flatMap((entry) => entry.branch ? [entry.branch] : []),
		...refs.stdout.trim().split("\n").filter(Boolean),
	])].filter((branch) => matchesIssueBranch(branch, target.number));
	if (matches.length > 1) {
		ctx.ui.notify(`Multiple branches match issue #${target.number}: ${matches.join(", ")}. Use /pac-worktree branch <name> to choose explicitly.`, "error"); return;
	}
	const branchType = type ?? (issue.value.labels.some((label) => label.name.toLowerCase() === "bug") ? "bugfix" : "feature");
	const branch = matches[0] ?? buildIssueBranch(issue.value.number, issue.value.title, branchType);
	const result = await ensureWorktree(pi, branch, (text) => ctx.ui.notify(text, "info"));
	if (!result.ok) { ctx.ui.notify(result.error, "error"); return; }
	ctx.ui.notify(formatIssueWorktreeSummary({ ...result.value, branch, issueNumber: issue.value.number, issueTitle: issue.value.title }), "info");
}

async function inferRepo(pi: ExtensionAPI): Promise<CommandResult<string>> {
	const result = await pi.exec("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], { timeout: 30_000 });
	if (result.code !== 0) return { ok: false, error: formatExecError("Could not infer GitHub repository", result) };
	const repo = result.stdout.trim();
	if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) return { ok: false, error: "Could not infer GitHub repository." };
	return { ok: true, value: repo };
}

async function fetchIssue(pi: ExtensionAPI, repo: string, number: number): Promise<CommandResult<IssueMetadata>> {
	const result = await pi.exec("gh", ["issue", "view", String(number), "--repo", repo, "--json", "number,title,url,labels"], { timeout: 30_000 });
	if (result.code !== 0) return { ok: false, error: formatExecError(`Could not read issue #${number}`, result) };
	try {
		const parsed = JSON.parse(result.stdout) as IssueMetadata;
		const target = typeof parsed.url === "string" ? parseIssueTarget(parsed.url) : null;
		if (parsed.number !== number || typeof parsed.title !== "string" || !target || target.kind !== "url" || `${target.owner}/${target.repo}`.toLowerCase() !== repo.toLowerCase() || target.number !== number || !Array.isArray(parsed.labels) || !parsed.labels.every((label) => typeof label?.name === "string")) throw new Error("invalid issue metadata");
		return { ok: true, value: parsed };
	} catch (error) {
		return { ok: false, error: `Could not parse issue #${number} metadata: ${error instanceof Error ? error.message : String(error)}` };
	}
}

export async function ensureWorktree(pi: ExtensionAPI, branch: string, onProgress?: (message: string) => void): Promise<CommandResult<{ created: boolean; path: string }>> {
	onProgress?.("Checking Worktrunk worktrees...");
	const before = await listWorktrees(pi);
	if (!before.ok) return before;
	const existing = findWorktreeByBranch(before.value, branch);
	if (existing && !existing.path) return { ok: false, error: `Worktree for ${branch} exists but has no path in wt list output.` };
	if (existing?.path) return { ok: true, value: { created: false, path: existing.path } };

	const approvals = await pi.exec("wt", ["config", "approvals", "list", "--format=json"], { timeout: 30_000 });
	if (approvals.code !== 0) return { ok: false, error: formatExecError("Could not inspect hook approvals; update Worktrunk if unsupported", approvals) };
	try {
		const data = JSON.parse(approvals.stdout) as { state: string; commands: { template: string; approved: boolean }[] };
		if (!["approved", "no_commands", "approval_required"].includes(data.state) || !Array.isArray(data.commands)) throw new Error("invalid approval state");
		if (data.state === "approval_required" || data.commands.some((command) => command.approved !== true)) {
			return { ok: false, error: `Project commands require your approval:\n${data.commands.filter((command) => !command.approved).map((command) => command.template).join("\n")}\nReview in your terminal with: wt config approvals list\nThen explicitly approve with: wt config approvals add\nRetry /pac-worktree after approval. No worktree was created.` };
		}
	} catch (error) {
		return { ok: false, error: `Could not parse hook approvals: ${error instanceof Error ? error.message : String(error)}` };
	}
	const refs = await pi.exec("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
	if (refs.code !== 0 && refs.code !== 1) return { ok: false, error: formatExecError("Could not check branch", refs) };
	onProgress?.(`Creating Worktrunk worktree for ${branch}. This may run setup hooks...`);
	// Never bypass approval. Worktrunk rechecks approvals when it runs the hooks.
	const create = await pi.exec("wt", ["switch", ...(refs.code === 1 ? ["--create"] : []), "--no-cd", branch], { timeout: 120_000 });
	if (create.code !== 0) return { ok: false, error: formatExecError(`Could not prepare Worktrunk worktree for ${branch}. A worktree may remain; inspect wt list and retry /pac-worktree branch ${branch}`, create) };
	onProgress?.("Verifying Worktrunk worktree...");
	const after = await listWorktrees(pi);
	if (!after.ok) return after;
	const created = findWorktreeByBranch(after.value, branch);
	if (!created?.path) return { ok: false, error: `Worktrunk completed, but ${branch} was not found in wt list output.` };
	return { ok: true, value: { created: true, path: created.path } };
}

async function listWorktrees(pi: ExtensionAPI): Promise<CommandResult<ReturnType<typeof parseWorktrunkList>>> {
	const result = await pi.exec("wt", ["list", "--format=json"], { timeout: 30_000 });
	if (result.code !== 0) return { ok: false, error: formatExecError("Could not list Worktrunk worktrees", result) };
	try { return { ok: true, value: parseWorktrunkList(result.stdout) }; }
	catch (error) { return { ok: false, error: `Could not parse Worktrunk list: ${error instanceof Error ? error.message : String(error)}` }; }
}

function formatExecError(prefix: string, result: { code: number; stdout: string; stderr: string }): string {
	const details = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n");
	return details ? `${prefix}:\n${details}` : `${prefix} (exit ${result.code}).`;
}
