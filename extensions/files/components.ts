/**
 * TUI components for the files extension (file selector, action selector).
 */
import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import {
	Container,
	fuzzyFilter,
	Input,
	matchesKey,
	type SelectItem,
	SelectList,
	Spacer,
	Text,
	type TUI,
} from "@mariozechner/pi-tui";
import type { FileEntry } from "./path-utils.ts";

const MAX_EDIT_BYTES = 40 * 1024 * 1024;

// ─── Edit helpers ─────────────────────────────────────────────────────────────

export type EditCheckResult = {
	allowed: boolean;
	reason?: string;
	content?: string;
};

export function getEditableContent(target: FileEntry): EditCheckResult {
	if (!existsSync(target.resolvedPath)) {
		return { allowed: false, reason: "File not found" };
	}

	const stats = statSync(target.resolvedPath);
	if (stats.isDirectory()) {
		return { allowed: false, reason: "Directories cannot be edited" };
	}

	if (stats.size >= MAX_EDIT_BYTES) {
		return { allowed: false, reason: "File is too large" };
	}

	const buffer = readFileSync(target.resolvedPath);
	if (buffer.includes(0)) {
		return { allowed: false, reason: "File contains null bytes" };
	}

	return { allowed: true, content: buffer.toString("utf8") };
}

// ─── Path actions ─────────────────────────────────────────────────────────────

export async function openPath(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	target: FileEntry,
): Promise<void> {
	if (!existsSync(target.resolvedPath)) {
		ctx.ui.notify(`File not found: ${target.displayPath}`, "error");
		return;
	}

	const command = process.platform === "darwin" ? "open" : "xdg-open";
	const result = await pi.exec(command, [target.resolvedPath]);
	if (result.code !== 0) {
		const errorMessage = result.stderr?.trim() || `Failed to open ${target.displayPath}`;
		ctx.ui.notify(errorMessage, "error");
	}
}

export function openExternalEditor(tui: TUI, editorCmd: string, content: string): string | null {
	const tmpFile = path.join(os.tmpdir(), `pi-files-edit-${Date.now()}.txt`);

	try {
		writeFileSync(tmpFile, content, "utf8");
		tui.stop();

		const result = spawnSync("sh", ["-c", '"$1" "$2"', "--", editorCmd, tmpFile], {
			stdio: "inherit",
		});

		if (result.status === 0) {
			return readFileSync(tmpFile, "utf8").replace(/\n$/, "");
		}

		return null;
	} finally {
		try {
			unlinkSync(tmpFile);
		} catch {
			// ignore
		}
		tui.start();
		tui.requestRender(true);
	}
}

export async function editPath(
	ctx: ExtensionContext,
	target: FileEntry,
	content: string,
): Promise<void> {
	const editorCmd = process.env.VISUAL || process.env.EDITOR;
	if (!editorCmd) {
		ctx.ui.notify("No editor configured. Set $VISUAL or $EDITOR.", "warning");
		return;
	}

	const updated = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
		const status = new Text(theme.fg("dim", `Opening ${editorCmd}...`));

		queueMicrotask(() => {
			const result = openExternalEditor(tui, editorCmd, content);
			done(result);
		});

		return status;
	});

	if (updated === null) {
		ctx.ui.notify("Edit cancelled", "info");
		return;
	}

	try {
		writeFileSync(target.resolvedPath, updated, "utf8");
	} catch {
		ctx.ui.notify(`Failed to save ${target.displayPath}`, "error");
	}
}

export async function revealPath(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	target: FileEntry,
): Promise<void> {
	if (!existsSync(target.resolvedPath)) {
		ctx.ui.notify(`File not found: ${target.displayPath}`, "error");
		return;
	}

	const isDirectory = target.isDirectory || statSync(target.resolvedPath).isDirectory();
	let command = "open";
	let args: string[] = [];

	if (process.platform === "darwin") {
		args = isDirectory ? [target.resolvedPath] : ["-R", target.resolvedPath];
	} else {
		command = "xdg-open";
		args = [isDirectory ? target.resolvedPath : path.dirname(target.resolvedPath)];
	}

	const result = await pi.exec(command, args);
	if (result.code !== 0) {
		const errorMessage = result.stderr?.trim() || `Failed to reveal ${target.displayPath}`;
		ctx.ui.notify(errorMessage, "error");
	}
}

export async function quickLookPath(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	target: FileEntry,
): Promise<void> {
	if (process.platform !== "darwin") {
		ctx.ui.notify("Quick Look is only available on macOS", "warning");
		return;
	}

	if (!existsSync(target.resolvedPath)) {
		ctx.ui.notify(`File not found: ${target.displayPath}`, "error");
		return;
	}

	const isDirectory = target.isDirectory || statSync(target.resolvedPath).isDirectory();
	if (isDirectory) {
		ctx.ui.notify("Quick Look only works on files", "warning");
		return;
	}

	const result = await pi.exec("qlmanage", ["-p", target.resolvedPath]);
	if (result.code !== 0) {
		const errorMessage =
			result.stderr?.trim() || `Failed to Quick Look ${target.displayPath}`;
		ctx.ui.notify(errorMessage, "error");
	}
}

export async function openDiff(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	target: FileEntry,
	gitRoot: string | null,
): Promise<void> {
	if (!gitRoot) {
		ctx.ui.notify("Git repository not found", "warning");
		return;
	}

	const relativePath = path
		.relative(gitRoot, target.resolvedPath)
		.split(path.sep)
		.join("/");
	const tmpDir = mkdtempSync(path.join(os.tmpdir(), "pi-files-"));
	const tmpFile = path.join(tmpDir, path.basename(target.displayPath));

	const existsInHead = await pi.exec(
		"git",
		["cat-file", "-e", `HEAD:${relativePath}`],
		{ cwd: gitRoot },
	);
	if (existsInHead.code === 0) {
		const result = await pi.exec("git", ["show", `HEAD:${relativePath}`], {
			cwd: gitRoot,
		});
		if (result.code !== 0) {
			const errorMessage =
				result.stderr?.trim() || `Failed to diff ${target.displayPath}`;
			ctx.ui.notify(errorMessage, "error");
			return;
		}
		writeFileSync(tmpFile, result.stdout ?? "", "utf8");
	} else {
		writeFileSync(tmpFile, "", "utf8");
	}

	let workingPath = target.resolvedPath;
	if (!existsSync(target.resolvedPath)) {
		workingPath = path.join(
			tmpDir,
			`pi-files-working-${path.basename(target.displayPath)}`,
		);
		writeFileSync(workingPath, "", "utf8");
	}

	const openResult = await pi.exec("code", ["--diff", tmpFile, workingPath], {
		cwd: gitRoot,
	});
	if (openResult.code !== 0) {
		const errorMessage =
			openResult.stderr?.trim() || `Failed to open diff for ${target.displayPath}`;
		ctx.ui.notify(errorMessage, "error");
	}
}

export function addFileToPrompt(ctx: ExtensionContext, target: FileEntry): void {
	const mentionTarget = target.displayPath || target.resolvedPath;
	const mention = `@${mentionTarget}`;
	const current = ctx.ui.getEditorText();
	const separator = current && !current.endsWith(" ") ? " " : "";
	ctx.ui.setEditorText(`${current}${separator}${mention}`);
	ctx.ui.notify(`Added ${mention} to prompt`, "info");
}

// ─── TUI selectors ────────────────────────────────────────────────────────────

export async function showActionSelector(
	ctx: ExtensionContext,
	options: { canQuickLook: boolean; canEdit: boolean; canDiff: boolean },
): Promise<"reveal" | "quicklook" | "open" | "edit" | "addToPrompt" | "diff" | null> {
	const actions: SelectItem[] = [
		...(options.canDiff ? [{ value: "diff", label: "Diff in VS Code" }] : []),
		{ value: "reveal", label: "Reveal in Finder" },
		{ value: "open", label: "Open" },
		{ value: "addToPrompt", label: "Add to prompt" },
		...(options.canQuickLook ? [{ value: "quicklook", label: "Open in Quick Look" }] : []),
		...(options.canEdit ? [{ value: "edit", label: "Edit" }] : []),
	];

	return ctx.ui.custom<
		"reveal" | "quicklook" | "open" | "edit" | "addToPrompt" | "diff" | null
	>((tui, theme, _kb, done) => {
		const container = new Container();
		container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
		container.addChild(new Text(theme.fg("accent", theme.bold("Choose action"))));

		const selectList = new SelectList(actions, actions.length, {
			selectedPrefix: (text) => theme.fg("accent", text),
			selectedText: (text) => theme.fg("accent", text),
			description: (text) => theme.fg("muted", text),
			scrollInfo: (text) => theme.fg("dim", text),
			noMatch: (text) => theme.fg("warning", text),
		});

		selectList.onSelect = (item) =>
			done(
				item.value as
					| "reveal"
					| "quicklook"
					| "open"
					| "edit"
					| "addToPrompt"
					| "diff",
			);
		selectList.onCancel = () => done(null);

		container.addChild(selectList);
		container.addChild(new Text(theme.fg("dim", "Press enter to confirm or esc to cancel")));
		container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

		return {
			render(width: number) {
				return container.render(width);
			},
			invalidate() {
				container.invalidate();
			},
			handleInput(data: string) {
				selectList.handleInput(data);
				tui.requestRender();
			},
		};
	});
}

export async function showFileSelector(
	ctx: ExtensionContext,
	files: FileEntry[],
	selectedPath?: string | null,
	gitRoot?: string | null,
): Promise<{ selected: FileEntry | null; quickAction: "diff" | null }> {
	const items: SelectItem[] = files.map((file) => {
		const directoryLabel = file.isDirectory ? " [directory]" : "";
		const statusSuffix = file.status ? ` [${file.status}]` : "";
		return {
			value: file.canonicalPath,
			label: `${file.displayPath}${directoryLabel}${statusSuffix}`,
		};
	});

	let quickAction: "diff" | null = null;
	const selection = await ctx.ui.custom<string | null>((tui, theme, keybindings, done) => {
		const container = new Container();
		container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
		container.addChild(new Text(theme.fg("accent", theme.bold(" Select file")), 0, 0));

		const searchInput = new Input();
		container.addChild(searchInput);
		container.addChild(new Spacer(1));

		const listContainer = new Container();
		container.addChild(listContainer);
		container.addChild(
			new Text(
				theme.fg(
					"dim",
					"Type to filter • enter to select • ctrl+shift+d diff • esc to cancel",
				),
				0,
				0,
			),
		);
		container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

		let filteredItems = items;
		let selectList: SelectList | null = null;

		const updateList = () => {
			listContainer.clear();
			if (filteredItems.length === 0) {
				listContainer.addChild(
					new Text(theme.fg("warning", "  No matching files"), 0, 0),
				);
				selectList = null;
				return;
			}

			selectList = new SelectList(filteredItems, Math.min(filteredItems.length, 12), {
				selectedPrefix: (text) => theme.fg("accent", text),
				selectedText: (text) => theme.fg("accent", text),
				description: (text) => theme.fg("muted", text),
				scrollInfo: (text) => theme.fg("dim", text),
				noMatch: (text) => theme.fg("warning", text),
			});

			if (selectedPath) {
				const index = filteredItems.findIndex((item) => item.value === selectedPath);
				if (index >= 0) {
					selectList.setSelectedIndex(index);
				}
			}

			selectList.onSelect = (item) => done(item.value as string);
			selectList.onCancel = () => done(null);

			listContainer.addChild(selectList);
		};

		const applyFilter = () => {
			const query = searchInput.getValue();
			filteredItems = query
				? fuzzyFilter(
						items,
						query,
						(item) => `${item.label} ${item.value} ${item.description ?? ""}`,
					)
				: items;
			updateList();
		};

		applyFilter();

		return {
			render(width: number) {
				return container.render(width);
			},
			invalidate() {
				container.invalidate();
			},
			handleInput(data: string) {
				if (matchesKey(data, "ctrl+shift+d")) {
					const selected = selectList?.getSelectedItem();
					if (selected) {
						const file = files.find(
							(entry) => entry.canonicalPath === selected.value,
						);
						const canDiff =
							file?.isTracked && !file.isDirectory && Boolean(gitRoot);
						if (!canDiff) {
							ctx.ui.notify(
								"Diff is only available for tracked files",
								"warning",
							);
							return;
						}
						quickAction = "diff";
						done(selected.value as string);
						return;
					}
				}

				if (
					keybindings.matches(data, "tui.select.up") ||
					keybindings.matches(data, "tui.select.down") ||
					keybindings.matches(data, "tui.select.confirm") ||
					keybindings.matches(data, "tui.select.cancel")
				) {
					if (selectList) {
						selectList.handleInput(data);
					} else if (keybindings.matches(data, "tui.select.cancel")) {
						done(null);
					}
					tui.requestRender();
					return;
				}

				searchInput.handleInput(data);
				applyFilter();
				tui.requestRender();
			},
		};
	});

	const selected = selection
		? files.find((file) => file.canonicalPath === selection) ?? null
		: null;
	return { selected, quickAction };
}
