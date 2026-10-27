export type IssueTarget =
	| { kind: "number"; number: number }
	| { kind: "url"; owner: string; repo: string; number: number };

export type WorktrunkListEntry = {
	branch: string | null;
	path?: string;
	isCurrent: boolean;
	isMain: boolean;
	mainState?: string;
	commit?: {
		shortSha?: string;
		message?: string;
	};
	workingTree?: {
		staged: boolean;
		modified: boolean;
		untracked: boolean;
		renamed: boolean;
		deleted: boolean;
		diff?: {
			added?: number;
			deleted?: number;
		};
	};
	main?: {
		ahead?: number;
		behind?: number;
	};
	remote?: {
		name?: string;
		branch?: string;
		ahead?: number;
		behind?: number;
	};
};

export function parseIssueTarget(input: string): IssueTarget | null {
	const value = input.trim();
	if (!value) return null;

	if (/^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))) {
		return { kind: "number", number: Number(value) };
	}

	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return null;
	}

	if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password) return null;
	const parts = url.pathname.split("/").filter(Boolean);
	if (parts.length !== 4 || parts[2] !== "issues" || !/^[1-9]\d*$/.test(parts[3]) || !Number.isSafeInteger(Number(parts[3]))) return null;

	return {
		kind: "url",
		owner: parts[0],
		repo: parts[1],
		number: Number(parts[3]),
	};
}

export function slugifyIssueTitle(title: string): string {
	return title
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

export type BranchType = "feature" | "bugfix" | "release";

export function buildIssueBranch(number: number, title: string, type: BranchType = "feature"): string {
	const slug = slugifyIssueTitle(title) || `issue-${number}`;
	return `ladislas/${type}/${number}-${slug}`;
}

export function matchesIssueBranch(branch: string, number: number): boolean {
	return new RegExp(`^[^/]+/(?:feature|bugfix|release)/${number}[-_][^/]+$`).test(branch);
}

export function manualCommand(branch: string): string {
	return `wt switch ${shellQuote(branch)} -x pi`;
}

export function parseWorktrunkList(output: string): WorktrunkListEntry[] {
	const parsed = JSON.parse(output.trim() || "[]") as unknown;
	if (!Array.isArray(parsed)) {
		throw new Error("expected wt list output to be a JSON array");
	}

	return parsed.map((item) => {
		const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
		const commit = parseRecord(record.commit);
		const workingTree = parseRecord(record.working_tree);
		const diff = parseRecord(workingTree?.diff);
		const main = parseRecord(record.main);
		const remote = parseRecord(record.remote);
		const entry: WorktrunkListEntry = {
			branch: typeof record.branch === "string" ? record.branch : null,
			path: typeof record.path === "string" && record.path.length > 0 ? record.path : undefined,
			isCurrent: record.is_current === true,
			isMain: record.is_main === true,
		};
		if (typeof record.main_state === "string") entry.mainState = record.main_state;
		if (commit) entry.commit = {
			shortSha: typeof commit.short_sha === "string" ? commit.short_sha : undefined,
			message: typeof commit.message === "string" ? commit.message : undefined,
		};
		if (workingTree) entry.workingTree = {
			staged: workingTree.staged === true,
			modified: workingTree.modified === true,
			untracked: workingTree.untracked === true,
			renamed: workingTree.renamed === true,
			deleted: workingTree.deleted === true,
			diff: diff
				? {
					added: typeof diff.added === "number" ? diff.added : undefined,
					deleted: typeof diff.deleted === "number" ? diff.deleted : undefined,
				}
				: undefined,
		};
		if (main) entry.main = {
			ahead: typeof main.ahead === "number" ? main.ahead : undefined,
			behind: typeof main.behind === "number" ? main.behind : undefined,
		};
		if (remote) entry.remote = {
			name: typeof remote.name === "string" ? remote.name : undefined,
			branch: typeof remote.branch === "string" ? remote.branch : undefined,
			ahead: typeof remote.ahead === "number" ? remote.ahead : undefined,
			behind: typeof remote.behind === "number" ? remote.behind : undefined,
		};
		return entry;
	});
}

function parseRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

export function findWorktreeByBranch(entries: WorktrunkListEntry[], branch: string): WorktrunkListEntry | undefined {
	return entries.find((entry) => entry.branch === branch);
}

export function formatIssueWorktreeSummary(input: {
	created: boolean;
	issueNumber: number;
	issueTitle: string;
	branch: string;
	path: string;
}): string {
	const status = input.created ? "Created worktree" : "Reusing existing worktree";
	return [
		`${status} for #${input.issueNumber}: ${input.issueTitle}`,
		`Branch: ${input.branch}`,
		`Path: ${input.path}`,
		"",
		"Open Pi:",
		manualCommand(input.branch),
	].join("\n");
}

export function formatBranchWorktreeSummary(input: { created: boolean; branch: string; path: string }): string {
	const status = input.created ? "Created worktree" : "Reusing existing worktree";
	return [
		`${status} for branch: ${input.branch}`,
		`Path: ${input.path}`,
		"",
		"Open Pi:",
		manualCommand(input.branch),
	].join("\n");
}

export function formatWorktreeList(entries: WorktrunkListEntry[]): string {
	if (entries.length === 0) return "No Worktrunk worktrees found.";

	return [
		"Worktrunk worktrees:",
		...entries.map((entry) => {
			const branch = entry.branch ?? "(detached)";
			const suffix = entry.isCurrent ? " (current)" : entry.isMain ? " (main)" : "";
			if (!entry.path) return `- ${branch}${suffix}\n  Path: unavailable`;
			return [`- ${branch}${suffix}`, `  Path: ${entry.path}`, `  Open Pi: ${entry.branch ? manualCommand(entry.branch) : `wt switch ${shellQuote(entry.path)} -x pi`}`].join("\n");
		}),
	].join("\n");
}

export function formatCurrentWorktreeStatus(entries: WorktrunkListEntry[]): string {
	const current = entries.find((entry) => entry.isCurrent);
	if (!current) return "Could not identify the current Worktrunk worktree from wt list output.";

	return [
		"Current Worktrunk worktree:",
		`Branch: ${current.branch ?? "(detached)"}`,
		`Path: ${current.path ?? "unavailable"}`,
		formatRelation(current),
		formatCommit(current),
		formatDirtyState(current),
	].filter(Boolean).join("\n");
}

function formatRelation(entry: WorktrunkListEntry): string | undefined {
	if (entry.remote) {
		const name = [entry.remote.name, entry.remote.branch].filter(Boolean).join("/") || "remote";
		return `Remote: ${name} (${formatAheadBehind(entry.remote)})`;
	}
	if (entry.main) {
		const state = entry.mainState ? `, state: ${entry.mainState}` : "";
		return `Main: ${formatAheadBehind(entry.main)}${state}`;
	}
	return entry.mainState ? `Main state: ${entry.mainState}` : undefined;
}

function formatCommit(entry: WorktrunkListEntry): string | undefined {
	if (!entry.commit?.shortSha && !entry.commit?.message) return undefined;
	return `Commit: ${[entry.commit.shortSha, entry.commit.message].filter(Boolean).join(" - ")}`;
}

function formatDirtyState(entry: WorktrunkListEntry): string {
	const tree = entry.workingTree;
	if (!tree) return "Dirty: unknown";

	const flags = [
		tree.staged ? "staged" : undefined,
		tree.modified ? "modified" : undefined,
		tree.untracked ? "untracked" : undefined,
		tree.renamed ? "renamed" : undefined,
		tree.deleted ? "deleted" : undefined,
	].filter(Boolean);
	const diff = tree.diff && (tree.diff.added || tree.diff.deleted) ? ` (+${tree.diff.added ?? 0}/-${tree.diff.deleted ?? 0})` : "";
	return `Dirty: ${flags.length > 0 ? flags.join(", ") : "clean"}${diff}`;
}

function formatAheadBehind(relation: { ahead?: number; behind?: number }): string {
	return `ahead ${relation.ahead ?? 0}, behind ${relation.behind ?? 0}`;
}

export function shellQuote(value: string): string {
	if (/^[A-Za-z0-9_/:=.,+@%-]+$/.test(value)) return value;
	return `'${value.replace(/'/g, `'"'"'`)}'`;
}
