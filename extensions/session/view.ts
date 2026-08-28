import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, Key, Text, matchesKey, type Component } from "@earendil-works/pi-tui";
import { buildSessionLines, type SessionStats } from "./session.ts";

interface ThemeLike {
	fg(tone: string, text: string): string;
	bold(text: string): string;
}

export class SessionView implements Component {
	private readonly container = new Container();

	constructor(theme: ThemeLike, stats: SessionStats, onDone: () => void) {
		this.container.addChild(new DynamicBorder((segment) => theme.fg("accent", segment)));
		this.container.addChild(new Text(theme.fg("accent", theme.bold("Session Info")) + theme.fg("dim", "  (Esc/q/Enter to close)"), 1, 0));
		this.container.addChild(new Text("", 1, 0));
		const bodyLines = buildSessionLines(stats, {
			heading: (text) => theme.bold(text),
			label: (text) => theme.fg("dim", text),
		}).slice(2);
		this.container.addChild(new Text(bodyLines.join("\n"), 1, 0));
		this.container.addChild(new Text("", 1, 0));
		this.container.addChild(new DynamicBorder((segment) => theme.fg("accent", segment)));
		this.onDone = onDone;
	}

	private readonly onDone: () => void;

	handleInput(data: string): void {
		if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c")) || data.toLowerCase() === "q" || data === "\r") this.onDone();
	}

	invalidate(): void {
		this.container.invalidate();
	}

	render(width: number): string[] {
		return this.container.render(width);
	}
}
