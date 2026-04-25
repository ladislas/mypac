import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { Container, Key, Text, matchesKey, type Component, type TUI } from "@mariozechner/pi-tui";
import type { ContextViewData } from "./data.ts";
import { buildViewLines, type ThemeLike } from "./render.ts";

export class ContextView implements Component {
	private container: Container;
	private body: Text;
	private cachedWidth?: number;

	constructor(
		_tui: TUI,
		private readonly theme: ThemeLike,
		private readonly data: ContextViewData,
		private readonly onDone: () => void,
	) {
		this.container = new Container();
		this.container.addChild(new DynamicBorder((segment) => theme.fg("accent", segment)));
		this.container.addChild(
			new Text(theme.fg("accent", theme.bold("Context")) + theme.fg("dim", "  (Esc/q/Enter to close)"), 1, 0),
		);
		this.container.addChild(new Text("", 1, 0));
		this.body = new Text("", 1, 0);
		this.container.addChild(this.body);
		this.container.addChild(new Text("", 1, 0));
		this.container.addChild(new DynamicBorder((segment) => theme.fg("accent", segment)));
	}

	private rebuild(width: number): void {
		this.body.setText(buildViewLines(this.theme, this.data, width).join("\n"));
		this.cachedWidth = width;
	}

	handleInput(data: string): void {
		if (
			matchesKey(data, Key.escape) ||
			matchesKey(data, Key.ctrl("c")) ||
			data.toLowerCase() === "q" ||
			data === "\r"
		) {
			this.onDone();
		}
	}

	invalidate(): void {
		this.container.invalidate();
		this.cachedWidth = undefined;
	}

	render(width: number): string[] {
		if (this.cachedWidth !== width) this.rebuild(width);
		return this.container.render(width);
	}
}
