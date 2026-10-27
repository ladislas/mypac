import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { shellQuote } from "./helpers.ts";

// Dynamic values travel in argv, never in AppleScript source or simulated typing.
const itermScript = `on run argv
	set launchCommand to item 1 of argv
	tell application "iTerm2"
		create window with default profile command launchCommand
	end tell
end run`;

export function buildLaunchCommand(path: string, issueUrl?: string): string {
	const draft = issueUrl ? `env ${shellQuote(`PAC_WORKTREE_DRAFT_ISSUE=${issueUrl}`)} ` : "";
	return `/bin/zsh -lc ${shellQuote(`cd -- ${shellQuote(path)} && exec ${draft}pi`)}`;
}

export async function launchPi(
	pi: ExtensionAPI,
	path: string,
	issueUrl?: string,
	runtime: { platform: string; env: NodeJS.ProcessEnv } = { platform: process.platform, env: process.env },
): Promise<{ ok: true } | { ok: false; error: string }> {
	if (runtime.platform !== "darwin" || !(runtime.env.TERM_PROGRAM === "iTerm.app" || runtime.env.ITERM_SESSION_ID)) {
		return { ok: false, error: "Automatic launch requires macOS and an iTerm session." };
	}
	try {
		const result = await pi.exec("/usr/bin/osascript", ["-e", itermScript, "--", buildLaunchCommand(path, issueUrl)], { timeout: 30_000 });
		if (result.code !== 0) return { ok: false, error: result.stderr.trim() || result.stdout.trim() || `osascript exited ${result.code}` };
		return { ok: true };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}
