import { buildWorkflowSessionName } from "../session-names/helpers.ts";

export function normalizeIssueNote(input: string): string {
	return input.trim();
}

export function buildIssueSessionName(note: string): string | undefined {
	return buildWorkflowSessionName("ghi", note);
}

export function buildIssueCreatePrompt(skillContent: string, note: string): string {
	return [
		skillContent.trim(),
		"",
		"---",
		"",
		"Create a GitHub issue for the current repository based on the note below.",
		"Stay within this create-only /ghi workflow.",
		"If the note is too ambiguous to create a useful issue, ask at most one brief follow-up question before creating it.",
		"",
		"Issue note:",
		normalizeIssueNote(note),
	].join("\n");
}
