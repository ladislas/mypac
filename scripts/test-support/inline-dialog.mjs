import { InteractiveMode } from "@earendil-works/pi-coding-agent";
import { Container, getKeybindings } from "@earendil-works/pi-tui";
import { ProgramStatusReporter } from "../../node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/program-status-reporter.js";

import { initTheme } from "../../node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js";

initTheme("dark", false);

// Exercise the pinned host's real dialog stack and status cleanup, not a simulated lifecycle.
export function createInlineDialogHarness() {
	const reports = [];
	const calls = [];
	const host = Object.create(InteractiveMode.prototype);
	host.extensionDialogs = [];
	host.editor = { getText: () => "", setText() {} };
	host.editorContainer = new Container();
	host.keybindings = getKeybindings();
	host.ui = { requestRender() {}, setFocus() {} };
	host.programStatus = new ProgramStatusReporter(
		() => ({ setProgramStatus: (status) => reports.push(status) }),
		() => undefined,
	);
	host.programStatus.report();
	return {
		host, calls, reports,
		custom(factory, options) {
			calls.push(options);
			return host.showExtensionCustom(factory, options);
		},
		get component() { return host.extensionDialogs.at(-1)?.component; },
		get status() { return reports.at(-1); },
		async waitFor(count) {
			for (let i = 0; i < 100; i++) {
				if (calls.length >= count && host.extensionDialogs.length) return;
				await new Promise((resolve) => setImmediate(resolve));
			}
			throw new Error(`Dialog ${count} did not open`);
		},
	};
}
