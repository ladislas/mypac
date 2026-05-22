import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { analyzeSessionDirectory, DEFAULT_SESSION_ROOT, formatBreakdownReport } from "./helpers.ts";

export default function sessionBreakdownExtension(pi: ExtensionAPI): void {
	pi.registerCommand("session-breakdown", {
		description: "Show local Pi session usage stats for the last 7/30/90 days",
		handler: async (_args, ctx) => {
			ctx.ui.notify("Scanning local Pi session stats…", "info");
			const report = await analyzeSessionDirectory({ root: DEFAULT_SESSION_ROOT, signal: ctx.signal });
			const content = formatBreakdownReport(report);
			pi.sendMessage(
				{
					customType: "session-breakdown",
					content,
					display: true,
					details: {
						root: report.root,
						scannedFiles: report.scannedFiles,
						parsedSessions: report.parsedSessions,
					},
				},
				{ triggerTurn: false },
			);
		},
	});
}
