import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildSessionStats, buildSessionText } from "./session.ts";
import { SessionView } from "./view.ts";

export default function sessionExtension(pi: ExtensionAPI): void {
	pi.registerCommand("session", {
		description: "Show session statistics",
		handler: async (_args, ctx) => {
			const stats = buildSessionStats(ctx);
			if (ctx.mode !== "tui") {
				pi.sendMessage({ customType: "session", content: buildSessionText(stats), display: true }, { triggerTurn: false });
				return;
			}

			await ctx.ui.custom<void>((_tui, theme, _keybindings, done) => new SessionView(theme, stats, done));
		},
	});
}
