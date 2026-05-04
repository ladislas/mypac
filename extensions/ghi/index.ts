import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { buildIssueCreatePrompt, buildIssueSessionName, normalizeIssueNote } from "./helpers.ts";
import { loadPackageSkill } from "../../lib/skill-loader.ts";

export default function ghiExtension(pi: ExtensionAPI): void {
	pi.registerCommand("ghi", {
		description: "Create a GitHub issue in the current repository",
		handler: async (args, ctx) => {
			if (!ctx.isIdle()) {
				ctx.ui.notify("/ghi can only run while the agent is idle", "warning");
				return;
			}

			const repoCheck = await pi.exec("git", ["rev-parse", "--is-inside-work-tree"]);
			if (repoCheck.code !== 0 || repoCheck.stdout.trim() !== "true") {
				ctx.ui.notify("/ghi must be run inside a git repository", "error");
				return;
			}

			let note = normalizeIssueNote(args ?? "");
			if (!note) {
				if (!ctx.hasUI) {
					ctx.ui.notify("Provide an issue note, for example: /ghi fix README install steps", "error");
					return;
				}

				const input = await ctx.ui.input("Create GitHub issue", "Short issue note or title");
				note = normalizeIssueNote(input ?? "");
				if (!note) {
					ctx.ui.notify("Issue creation cancelled", "info");
					return;
				}
			}

			const skillResult = await loadPackageSkill("pac-github-issue-create");
			if (!skillResult) {
				ctx.ui.notify("Could not load skills/pac-github-issue-create/SKILL.md", "error");
				return;
			}

			const sessionName = buildIssueSessionName(note);
			if (sessionName) {
				pi.setSessionName(sessionName);
			}

			pi.sendUserMessage(buildIssueCreatePrompt(skillResult.content, note));
		},
	});
}
