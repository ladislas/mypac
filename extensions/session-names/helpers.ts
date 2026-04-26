const DEFAULT_SESSION_SUFFIX_MAX_LENGTH = 60;

function collapseWhitespace(input: string): string {
	return input.replace(/\s+/g, " ").trim();
}

function stripWrappingQuotes(input: string): string {
	if (input.length >= 2) {
		const first = input[0];
		const last = input[input.length - 1];
		if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
			return input.slice(1, -1).trim();
		}
	}
	return input;
}

function truncate(input: string, maxLength: number): string {
	if (input.length <= maxLength) return input;
	if (maxLength <= 3) return input.slice(0, maxLength);
	return input.slice(0, maxLength - 3) + "...";
}

function normalizeGithubReference(input: string): string | null {
	const issueMatch = input.match(/^https?:\/\/github\.com\/[^/]+\/[^/]+\/issues\/(\d+)(?:[/?#].*)?$/i);
	if (issueMatch) {
		return `issue #${issueMatch[1]}`;
	}

	const prMatch = input.match(/^https?:\/\/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)(?:[/?#].*)?$/i);
	if (prMatch) {
		return `PR #${prMatch[1]}`;
	}

	return null;
}

function normalizeTodoReference(input: string): string | null {
	const match = input.match(/^(todo-[a-z0-9]+)$/i);
	if (!match) return null;
	return match[1].replace(/^todo-/i, "TODO-");
}

function normalizeUrl(input: string): string | null {
	if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) return null;

	try {
		const url = new URL(input);
		const pathname = url.pathname.replace(/\/+$/, "") || "/";
		return `${url.host}${pathname}`;
	} catch {
		return null;
	}
}

export function normalizeSessionNameSuffix(
	input: string,
	maxLength: number = DEFAULT_SESSION_SUFFIX_MAX_LENGTH,
): string {
	const normalized = stripWrappingQuotes(collapseWhitespace(input));
	if (!normalized) return "";

	return truncate(
		normalizeGithubReference(normalized) ??
			normalizeTodoReference(normalized) ??
			normalizeUrl(normalized) ??
			normalized,
		maxLength,
	);
}

export function buildWorkflowSessionName(prefix: string, input: string): string | undefined {
	const normalizedPrefix = collapseWhitespace(prefix);
	const normalizedInput = normalizeSessionNameSuffix(input);
	if (!normalizedPrefix || !normalizedInput) return undefined;
	return `${normalizedPrefix} - ${normalizedInput}`;
}

export function extractSlashCommandArgument(text: string, commandName: string): string | null {
	const command = text.trimStart();
	const match = command.match(new RegExp(`^/${commandName}(?:\\s+([\\s\\S]*\\S))?\\s*$`));
	if (!match) return null;
	return match[1] ?? "";
}
