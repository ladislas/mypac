/**
 * Original source: https://github.com/mitsuhiko/agent-stuff/blob/main/extensions/btw.ts
 */
import { existsSync } from "node:fs";
import path from "node:path";
import {
	buildSessionContext,
	convertToLlm,
	createAgentSession,
	createExtensionRuntime,
	getMarkdownTheme,
	SessionManager,
	type AgentSession,
	type AgentSessionEvent,
	type ExtensionAPI,
	type ExtensionCommandContext,
	type ExtensionContext,
	type ResourceLoader,
} from "@mariozechner/pi-coding-agent";
import { type AssistantMessage, type Message, type ThinkingLevel as AiThinkingLevel } from "@mariozechner/pi-ai";
import {
	Container,
	Editor,
	Key,
	Markdown,
	matchesKey,
	truncateToWidth,
	visibleWidth,
	type EditorTheme,
	type Focusable,
	type KeybindingsManager,
	type OverlayHandle,
	type TUI,
} from "@mariozechner/pi-tui";
import {
	BTW_IMPORT_TYPE,
	BTW_SIDECAR_STATE_TYPE,
	createBaseSidecarState,
	getBtwSidecarLocation,
	getImportOverlayHint,
	getImportedContextSummary,
	getImportSourceLabel,
	isImportOverlayCommand,
	isPartialImportOverlayCommand,
	normalizeSidecarState,
	resolveImportTarget,
	restorePersistedState,
	type BtwImportSource,
	type BtwLaunchAnchor,
	type BtwRestoredState,
	type BtwSidecarLocation,
	type BtwSidecarState,
} from "./sidecar.ts";

const BTW_ENTRY_TYPE = "btw-thread-entry";
const BTW_RESET_TYPE = "btw-thread-reset";
const TRUNCATED_TOOL_CALL_SUFFIX = "...";

const BTW_SYSTEM_PROMPT = [
	"You are BTW, an isolated side-channel assistant embedded in the user's coding agent.",
	"You are isolated from the main conversation by default; the user may explicitly import a frozen main-session snapshot for reference.",
	"Help with focused questions, planning, and quick explorations.",
	"Be direct and practical.",
].join(" ");

const BTW_SUMMARY_PROMPT =
	"Summarize this side conversation for handoff into the main conversation. Keep key decisions, findings, risks, and next actions. Output only the summary.";

type SessionThinkingLevel = "off" | AiThinkingLevel;

type BtwDetails = {
	question: string;
	answer: string;
	timestamp: number;
	api?: AssistantMessage["api"];
	provider: string;
	model: string;
	thinkingLevel: SessionThinkingLevel;
	usage?: AssistantMessage["usage"];
	toolCalls?: ToolCallInfo[];
};

type BtwResetDetails = {
	timestamp: number;
};

type BtwImportDetails = {
	messages: Message[];
	timestamp: number;
	messageCount: number;
	source?: BtwImportSource;
};

type OverlayRuntime = {
	handle?: OverlayHandle;
	refresh?: () => void;
	close?: () => void;
	finish?: () => void;
	setDraft?: (value: string) => void;
	resetScroll?: () => void;
	closed?: boolean;
};

type SideSessionRuntime = {
	session: AgentSession;
	modelKey: string;
	unsubscribe: () => void;
};

type BtwSidecarRuntime = {
	sessionManager: SessionManager;
	location: BtwSidecarLocation;
	state: BtwSidecarState;
	sessionKey: string;
};

type ToolCallInfo = {
	toolCallId: string;
	toolName: string;
	args: string;
	status: "running" | "done" | "error";
};

function stripDynamicSystemPromptFooter(systemPrompt: string): string {
	return systemPrompt
		.replace(/\nCurrent date and time:[^\n]*(?:\nCurrent working directory:[^\n]*)?$/u, "")
		.replace(/\nCurrent working directory:[^\n]*$/u, "")
		.trim();
}

function createBtwResourceLoader(ctx: ExtensionContext, appendSystemPrompt: string[] = [BTW_SYSTEM_PROMPT]): ResourceLoader {
	const extensionsResult = { extensions: [], errors: [], runtime: createExtensionRuntime() };
	const systemPrompt = stripDynamicSystemPromptFooter(ctx.getSystemPrompt());

	return {
		getExtensions: () => extensionsResult,
		getSkills: () => ({ skills: [], diagnostics: [] }),
		getPrompts: () => ({ prompts: [], diagnostics: [] }),
		getThemes: () => ({ themes: [], diagnostics: [] }),
		getAgentsFiles: () => ({ agentsFiles: [] }),
		getSystemPrompt: () => systemPrompt,
		getAppendSystemPrompt: () => appendSystemPrompt,
		extendResources: () => {},
		reload: async () => {},
	};
}

function extractText(parts: AssistantMessage["content"]): string {
	return parts
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("\n")
		.trim();
}

function extractEventAssistantText(message: unknown): string {
	if (!message || typeof message !== "object") {
		return "";
	}

	const maybeMessage = message as { role?: unknown; content?: unknown };
	if (maybeMessage.role !== "assistant" || !Array.isArray(maybeMessage.content)) {
		return "";
	}

	return maybeMessage.content
		.filter((part): part is { type: "text"; text: string } => {
			return !!part && typeof part === "object" && (part as { type?: unknown }).type === "text";
		})
		.map((part) => part.text)
		.join("\n")
		.trim();
}

function getLastAssistantMessage(session: AgentSession): AssistantMessage | null {
	for (let i = session.state.messages.length - 1; i >= 0; i--) {
		const message = session.state.messages[i];
		if (message.role === "assistant") {
			return message as AssistantMessage;
		}
	}

	return null;
}

function buildSeedMessages(thread: BtwDetails[], importedContext: Message[] | null): Message[] {
	const seed: Message[] = [];

	if (importedContext) {
		seed.push(...importedContext);
	}

	for (const item of thread) {
		seed.push(
			{
				role: "user",
				content: [{ type: "text", text: item.question }],
				timestamp: item.timestamp,
			},
			{
				role: "assistant",
				content: [{ type: "text", text: item.answer }],
				provider: item.provider,
				model: item.model,
				api: item.api ?? "openai-responses",
				usage:
					item.usage ??
					{
						input: 0,
						output: 0,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 0,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
					},
				stopReason: "stop",
				timestamp: item.timestamp,
			},
		);
	}

	return seed;
}

function formatThread(thread: BtwDetails[]): string {
	return thread
		.map((item) => `User: ${item.question.trim()}\nAssistant: ${item.answer.trim()}`)
		.join("\n\n---\n\n");
}

function notify(ctx: ExtensionContext | ExtensionCommandContext, message: string, level: "info" | "warning" | "error"): void {
	if (ctx.hasUI) {
		ctx.ui.notify(message, level);
	}
}

function getMainSessionFile(ctx: ExtensionContext | ExtensionCommandContext): string | undefined {
	const file = ctx.sessionManager.getSessionFile();
	return file ? path.resolve(file) : undefined;
}

function getCurrentSessionKey(ctx: ExtensionContext | ExtensionCommandContext): string {
	return `${ctx.sessionManager.getSessionId()}:${getMainSessionFile(ctx) ?? ""}`;
}

function forceRewriteSidecar(sidecar: SessionManager): void {
	(sidecar as unknown as { _rewriteFile?: () => void })._rewriteFile?.();
}

function readSidecarState(
	ctx: ExtensionContext | ExtensionCommandContext,
	sidecar: SessionManager,
): BtwSidecarState {
	let latestState: BtwSidecarState | null = null;
	for (const entry of sidecar.getEntries()) {
		if (entry.type !== "custom" || entry.customType !== BTW_SIDECAR_STATE_TYPE) {
			continue;
		}
		latestState = entry.data as BtwSidecarState | null;
	}
	return normalizeSidecarState(
		createBaseSidecarState(ctx.sessionManager.getSessionId(), getMainSessionFile(ctx)),
		latestState,
	);
}

function appendSidecarEntry(sidecar: BtwSidecarRuntime, customType: string, data?: unknown): void {
	sidecar.sessionManager.appendCustomEntry(customType, data);
	forceRewriteSidecar(sidecar.sessionManager);
}

function persistSidecarState(
	ctx: ExtensionContext | ExtensionCommandContext,
	sidecar: BtwSidecarRuntime,
	state: BtwSidecarState,
): void {
	sidecar.state = normalizeSidecarState(
		createBaseSidecarState(ctx.sessionManager.getSessionId(), getMainSessionFile(ctx)),
		state,
	);
	appendSidecarEntry(sidecar, BTW_SIDECAR_STATE_TYPE, sidecar.state);
}


class BtwOverlay extends Container implements Focusable {
	private readonly editor: Editor;
	private readonly tui: TUI;
	private readonly theme: ExtensionContext["ui"]["theme"];
	private readonly keybindings: KeybindingsManager;
	private readonly getTranscript: (width: number, theme: ExtensionContext["ui"]["theme"]) => string[];
	private readonly getStatus: () => string;
	private readonly getImportHint: () => string;
	private readonly onSubmitCallback: (value: string) => void;
	private readonly onDismissCallback: () => void;
	private _focused = false;
	private scrollOffset = 0; // lines from the bottom; 0 = at bottom

	get focused(): boolean {
		return this._focused;
	}

	set focused(value: boolean) {
		this._focused = value;
		this.editor.focused = value;
	}

	constructor(
		tui: TUI,
		theme: ExtensionContext["ui"]["theme"],
		keybindings: KeybindingsManager,
		getTranscript: (width: number, theme: ExtensionContext["ui"]["theme"]) => string[],
		getStatus: () => string,
		getImportHint: () => string,
		onSubmit: (value: string) => void,
		onDismiss: () => void,
	) {
		super();
		this.tui = tui;
		this.theme = theme;
		this.keybindings = keybindings;
		this.getTranscript = getTranscript;
		this.getStatus = getStatus;
		this.getImportHint = getImportHint;
		this.onSubmitCallback = onSubmit;
		this.onDismissCallback = onDismiss;

		const editorTheme: EditorTheme = {
			borderColor: (s) => theme.fg("borderAccent", s),
			selectList: {
				selectedPrefix: (t) => theme.fg("accent", t),
				selectedText: (t) => theme.fg("accent", t),
				description: (t) => theme.fg("muted", t),
				scrollInfo: (t) => theme.fg("dim", t),
				noMatch: (t) => theme.fg("warning", t),
			},
		};
		this.editor = new Editor(tui, editorTheme, { paddingX: 0 });
		this.editor.onSubmit = (value) => {
			this.onSubmitCallback(value);
		};
	}

	resetScroll(): void {
		this.scrollOffset = 0;
	}

	handleInput(data: string): void {
		if (this.keybindings.matches(data, "tui.select.cancel")) {
			this.onDismissCallback();
			return;
		}

		if (matchesKey(data, Key.pageUp)) {
			this.scrollOffset += 5;
			this.tui.requestRender();
			return;
		}

		if (matchesKey(data, Key.pageDown)) {
			this.scrollOffset = Math.max(0, this.scrollOffset - 5);
			this.tui.requestRender();
			return;
		}

		this.editor.handleInput(data);
	}

	setDraft(value: string): void {
		this.editor.setText(value);
		this.tui.requestRender();
	}

	getDraft(): string {
		return this.editor.getExpandedText();
	}

	private frameLine(content: string, innerWidth: number): string {
		const truncated = truncateToWidth(content, innerWidth, "");
		const padding = Math.max(0, innerWidth - visibleWidth(truncated));
		return `${this.theme.fg("border", "│")}${truncated}${" ".repeat(padding)}${this.theme.fg("border", "│")}`;
	}

	private borderLine(innerWidth: number, edge: "top" | "bottom"): string {
		const left = edge === "top" ? "┌" : "└";
		const right = edge === "top" ? "┐" : "┘";
		return this.theme.fg("border", `${left}${"─".repeat(innerWidth)}${right}`);
	}

		override render(width: number): string[] {
		const dialogWidth = width - 6;
		const innerWidth = Math.max(40, dialogWidth - 2);
		const terminalRows = process.stdout.rows ?? 30;
		const dialogHeight = Math.max(16, Math.min(30, Math.floor(terminalRows * 0.75)));

		// Render editor first so we know how many lines it occupies
		const editorLines = this.editor.render(innerWidth);

		// Static chrome: top border + title + subtitle + 2 separators + status + 2 hint lines + bottom border
		const staticChrome = 9;
		const transcriptHeight = Math.max(0, dialogHeight - staticChrome - editorLines.length);

		// Markdown renders to innerWidth already — no manual wrapping needed
		const transcript = this.getTranscript(innerWidth, this.theme);
		const totalLines = transcript.length;

		// Clamp scroll offset to the valid range
		const maxScrollOffset = Math.max(0, totalLines - transcriptHeight);
		this.scrollOffset = Math.min(this.scrollOffset, maxScrollOffset);

		const linesBelow = this.scrollOffset;
		const linesAbove = Math.max(0, totalLines - transcriptHeight - linesBelow);

		// Reserve indicator slots only when the transcript area has room for them.
		const showTopIndicator = linesAbove > 0 && transcriptHeight > 0;
		const showBottomIndicator = linesBelow > 0 && transcriptHeight > (showTopIndicator ? 1 : 0);
		const topSlot = showTopIndicator ? 1 : 0;
		const bottomSlot = showBottomIndicator ? 1 : 0;
		const contentSlots = Math.max(0, transcriptHeight - topSlot - bottomSlot);

		const endIdx = totalLines - linesBelow;
		const startIdx = Math.max(0, endIdx - contentSlots);
		const visibleTranscript = transcript.slice(startIdx, Math.max(0, endIdx));
		const transcriptPadding = Math.max(0, contentSlots - visibleTranscript.length);

		const status = this.getStatus();
		const importHint = this.getImportHint();

		const lines = [
			this.borderLine(innerWidth, "top"),
			this.frameLine(this.theme.fg("accent", this.theme.bold(" BTW side chat ")), innerWidth),
			this.frameLine(this.theme.fg("dim", `Isolated side conversation. ${importHint}`), innerWidth),
			this.theme.fg("border", `├${"─".repeat(innerWidth)}┤`),
		];

		if (showTopIndicator) {
			lines.push(this.frameLine(this.theme.fg("dim", `↑ ${linesAbove} more line${linesAbove === 1 ? "" : "s"} above`), innerWidth));
		}
		for (const line of visibleTranscript) {
			lines.push(this.frameLine(line, innerWidth));
		}
		for (let i = 0; i < transcriptPadding; i++) {
			lines.push(this.frameLine("", innerWidth));
		}
		if (showBottomIndicator) {
			lines.push(this.frameLine(this.theme.fg("dim", `↓ ${linesBelow} more line${linesBelow === 1 ? "" : "s"} below`), innerWidth));
		}

		lines.push(this.theme.fg("border", `├${"─".repeat(innerWidth)}┤`));
		lines.push(this.frameLine(this.theme.fg("warning", status), innerWidth));
		for (const line of editorLines) {
			lines.push(this.frameLine(line, innerWidth));
		}
		lines.push(
			this.frameLine(this.theme.fg("dim", "PgUp/PgDn scroll · Enter submit · Shift+Enter newline"), innerWidth),
			this.frameLine(this.theme.fg("dim", "/import import/refresh · Esc close"), innerWidth),
		);
		lines.push(this.borderLine(innerWidth, "bottom"));

		return lines.map((l) => `   ${l}`);
	}
}

export default function (pi: ExtensionAPI) {
	let thread: BtwDetails[] = [];
	let pendingQuestion: string | null = null;
	let pendingAnswer = "";
	let pendingError: string | null = null;
	let pendingToolCalls: ToolCallInfo[] = [];
	let sideBusy = false;
	let sideRequestId = 0;
	let cancelledSideRequestId: number | null = null;
	let overlayStatus = "Ready";
	let overlayDraft = "";
	let overlayRuntime: OverlayRuntime | null = null;
	let activeSideSession: SideSessionRuntime | null = null;
	let activeSidecar: BtwSidecarRuntime | null = null;
	let overlayRefreshTimer: ReturnType<typeof setTimeout> | null = null;
	let importedContextMessages: Message[] | null = null;
	let importedContextTimestamp: number | null = null;
	let importedContextMessageCount = 0;
	let importedContextSource: BtwImportSource | null = null;
	let launchAnchor: BtwLaunchAnchor | null = null;

	const mdTheme = getMarkdownTheme();

	function getModelKey(ctx: ExtensionContext): string {
		const model = ctx.model;
		return model ? `${model.provider}/${model.id}` : "none";
	}

	function applyRestoredState(restored: BtwRestoredState<BtwDetails, BtwImportDetails>, state: BtwSidecarState | null): void {
		thread = restored.thread;
		importedContextMessages = restored.importedContext?.messages ?? null;
		importedContextTimestamp = restored.importedContext?.timestamp ?? null;
		importedContextMessageCount = restored.importedContext?.messageCount ?? 0;
		importedContextSource = restored.importedContext?.source ?? null;
		launchAnchor = state?.anchor ?? null;
		if (activeSidecar) {
			activeSidecar.state = state ?? activeSidecar.state;
		}
	}

	function ensureSidecarRuntime(
		ctx: ExtensionContext | ExtensionCommandContext,
		options: { createIfMissing?: boolean } = {},
	): BtwSidecarRuntime | null {
		const createIfMissing = options.createIfMissing ?? true;
		const sessionKey = getCurrentSessionKey(ctx);
		const location = getBtwSidecarLocation(ctx.sessionManager.getSessionDir(), ctx.sessionManager.getSessionId());
		const sidecarExists = existsSync(location.file);

		if (!createIfMissing && !sidecarExists) {
			activeSidecar = null;
			return null;
		}

		if (activeSidecar && activeSidecar.sessionKey === sessionKey && existsSync(activeSidecar.location.file)) {
			return activeSidecar;
		}

		const sessionManager = SessionManager.open(location.file, location.dir, ctx.cwd);
		const header = sessionManager.getHeader();
		const mainSessionFile = getMainSessionFile(ctx);
		if (header && mainSessionFile && header.parentSession !== mainSessionFile) {
			header.parentSession = mainSessionFile;
			forceRewriteSidecar(sessionManager);
		}

		activeSidecar = {
			sessionManager,
			location,
			state: readSidecarState(ctx, sessionManager),
			sessionKey,
		};

		const hasStateEntry = sessionManager.getEntries().some((entry) => {
			return entry.type === "custom" && entry.customType === BTW_SIDECAR_STATE_TYPE;
		});
		if (!hasStateEntry) {
			persistSidecarState(ctx, activeSidecar, activeSidecar.state);
		}

		return activeSidecar;
	}

	function migrateLegacyInlineState(ctx: ExtensionContext): BtwRestoredState<BtwDetails, BtwImportDetails> {
		const legacy = restorePersistedState<BtwDetails, BtwImportDetails>(ctx.sessionManager.getBranch(), {
			entryType: BTW_ENTRY_TYPE,
			resetType: BTW_RESET_TYPE,
			importType: BTW_IMPORT_TYPE,
			stateType: BTW_SIDECAR_STATE_TYPE,
		});
		if (!legacy.hasLegacyEntries) {
			return legacy;
		}

		const sidecar = ensureSidecarRuntime(ctx);
		if (!sidecar) {
			return legacy;
		}

		for (const item of legacy.thread) {
			appendSidecarEntry(sidecar, BTW_ENTRY_TYPE, item);
		}
		if (legacy.importedContext) {
			appendSidecarEntry(sidecar, BTW_IMPORT_TYPE, {
				...legacy.importedContext,
				source: legacy.importedContext.source ?? "legacy",
			});
		}

		persistSidecarState(ctx, sidecar, {
			...sidecar.state,
			migratedFromInlineAt: Date.now(),
			importedContext: getImportedContextSummary(legacy.importedContext),
		});

		return {
			...legacy,
			state: sidecar.state,
		};
	}

	function renderMarkdownLines(text: string, width: number): string[] {
		if (!text) return [];
		try {
			const md = new Markdown(text, 0, 0, mdTheme);
			return md.render(width);
		} catch {
			// Fall back to plain text wrapping if Markdown rendering fails
			return text.split("\n").flatMap((line) => {
				if (!line) return [""];
				const wrapped: string[] = [];
				for (let i = 0; i < line.length; i += width) {
					wrapped.push(line.slice(i, i + width));
				}
				return wrapped.length > 0 ? wrapped : [""];
			});
		}
	}

	function formatToolArgs(toolName: string, args: unknown): string {
		if (!args || typeof args !== "object") return "";
		const a = args as Record<string, unknown>;
		switch (toolName) {
			case "bash":
				return typeof a.command === "string"
					? truncateToWidth(a.command.split("\n")[0], 50, TRUNCATED_TOOL_CALL_SUFFIX)
					: "";
			case "read":
			case "write":
			case "edit":
				return typeof a.path === "string" ? a.path : "";
			default: {
				const first = Object.values(a)[0];
				return typeof first === "string"
					? truncateToWidth(first.split("\n")[0], 40, TRUNCATED_TOOL_CALL_SUFFIX)
					: "";
			}
		}
	}

	function getImportHint(): string {
		return getImportOverlayHint(importedContextMessages !== null);
	}

	function filterMessagesForBtw(messages: ReturnType<typeof buildSessionContext>["messages"]): Message[] {
		return convertToLlm(
			messages.filter((message) => {
				return (
					message.role === "user" ||
					message.role === "assistant" ||
					message.role === "branchSummary" ||
					message.role === "compactionSummary"
				);
			}),
		);
	}

	function buildImportedContextMessages(
		messages: Message[],
		timestamp: number,
		source: BtwImportSource,
	): Message[] {
		const MAX_CHARS = 15000;
		const markerTimestamp = Math.max(0, timestamp - 2);
		const sourceLabel = source === "launch" ? "BTW launch time" : source === "refresh" ? "the current main session" : "a previous BTW session";
		const startMarker: Message = {
			role: "user",
			content: [{
				type: "text",
				text: `Imported frozen snapshot from ${sourceLabel} at ${new Date(timestamp).toISOString()}. The following messages are reference context for BTW and stay frozen until you refresh or reset BTW.`,
			}],
			timestamp: markerTimestamp,
		};
		const endMarker: Message = {
			role: "user",
			content: [{
				type: "text",
				text: "End of imported main-session snapshot. Continue the BTW side conversation below.",
			}],
			timestamp: Math.max(0, timestamp - 1),
		};
		const truncatedMarker: Message = {
			role: "user",
			content: [{ type: "text", text: "[...older imported context omitted...]" }],
			timestamp: markerTimestamp,
		};

		const normalizedBlocks: Message[] = [];
		let bodyChars = 0;

		for (const msg of messages) {
			if (msg.role === "user") {
				const content = (msg as { role: "user"; content: string | Array<{ type: string; text?: string }> }).content;
				const text =
					typeof content === "string"
						? content.trim()
						: (content as Array<{ type: string; text?: string }>)
								.filter((part) => part.type === "text")
								.map((part) => part.text ?? "")
								.join("\n")
								.trim();
				if (!text) {
					continue;
				}
				normalizedBlocks.push({
					role: "user",
					content: [{ type: "text", text }],
					timestamp: msg.timestamp,
				});
				bodyChars += text.length;
				continue;
			}

			if (msg.role !== "assistant") {
				continue;
			}

			const assistantMsg = msg as AssistantMessage;
			const lines: string[] = [];
			for (const part of assistantMsg.content) {
				if (part.type === "text") {
					if (part.text.trim()) {
						lines.push(part.text.trim());
					}
				} else if (part.type === "toolCall") {
					const argSummary = formatToolArgs(part.name, part.arguments);
					lines.push(`[Tool: ${part.name}${argSummary ? ` ${argSummary}` : ""}]`);
				}
			}
			const text = lines.join("\n").trim();
			if (!text) {
				continue;
			}
			normalizedBlocks.push({
				role: "assistant",
				content: [{ type: "text", text }],
				provider: assistantMsg.provider,
				model: assistantMsg.model,
				api: assistantMsg.api,
				usage:
					assistantMsg.usage ??
					{
						input: 0,
						output: 0,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 0,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
					},
				stopReason: "stop",
				timestamp: assistantMsg.timestamp,
			});
			bodyChars += text.length;
		}

		const markerChars =
			(startMarker.content as Array<{ type: "text"; text: string }>)[0].text.length +
			(endMarker.content as Array<{ type: "text"; text: string }>)[0].text.length +
			(truncatedMarker.content as Array<{ type: "text"; text: string }>)[0].text.length;
		const originalNormalizedCount = normalizedBlocks.length;
		while (normalizedBlocks.length > 0 && bodyChars + markerChars > MAX_CHARS) {
			const removed = normalizedBlocks.shift();
			if (!removed) {
				break;
			}
			const removedText =
				removed.role === "user"
					? typeof removed.content === "string"
						? removed.content
						: removed.content
								.filter((part): part is { type: "text"; text: string } => part.type === "text")
								.map((part) => part.text)
								.join("\n")
					: removed.content
							.filter((part): part is { type: "text"; text: string } => part.type === "text")
							.map((part) => part.text)
							.join("\n");
			bodyChars -= removedText.length;
		}

		const importedMessages: Message[] = [startMarker];
		if (normalizedBlocks.length < originalNormalizedCount) {
			importedMessages.push(truncatedMarker);
		}
		importedMessages.push(...normalizedBlocks, endMarker);
		return importedMessages;
	}

	function renderToolCallLines(toolCalls: ToolCallInfo[], theme: ExtensionContext["ui"]["theme"], width: number): string[] {
		const lines: string[] = [];
		for (const tc of toolCalls) {
			const icon = tc.status === "running" ? "⚙" : tc.status === "error" ? "✗" : "✓";
			const color = tc.status === "error" ? "error" : tc.status === "done" ? "success" : "dim";
			const label = theme.fg(color, `${icon} `) + theme.fg("toolTitle", tc.toolName);
			const argsText = tc.args
				? tc.args.endsWith(TRUNCATED_TOOL_CALL_SUFFIX)
					? `${theme.fg("dim", ` ${tc.args.slice(0, -TRUNCATED_TOOL_CALL_SUFFIX.length)}`)}${theme.fg("dim", TRUNCATED_TOOL_CALL_SUFFIX)}`
					: theme.fg("dim", ` ${tc.args}`)
				: "";
			lines.push(truncateToWidth(`  ${label}${argsText}`, width, theme.fg("dim", TRUNCATED_TOOL_CALL_SUFFIX)));
		}
		return lines;
	}

	function getTranscriptLines(width: number, theme: ExtensionContext["ui"]["theme"]): string[] {
		try {
			return getTranscriptLinesInner(width, theme);
		} catch (error) {
			return [theme.fg("error", `Render error: ${error instanceof Error ? error.message : String(error)}`)];
		}
	}

	function getTranscriptLinesInner(width: number, theme: ExtensionContext["ui"]["theme"]): string[] {
		const lines: string[] = [];
		if (importedContextMessages !== null && importedContextTimestamp !== null) {
			const time = new Date(importedContextTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			const countStr = importedContextMessageCount > 0 ? ` · ${importedContextMessageCount} msgs` : "";
			const sourceStr = importedContextSource ? ` · ${getImportSourceLabel(importedContextSource)}` : "";
			lines.push(theme.fg("dim", `↑ context from main session (${time}${countStr}${sourceStr})`));
			lines.push("");
		}

		if (thread.length === 0 && !pendingQuestion && !pendingAnswer && !pendingError) {
			lines.push(
				theme.fg(
					"dim",
					importedContextMessages !== null
						? "Main session context restored. Ask a question below."
						: "No BTW messages yet. Type a question below.",
				),
			);
			return lines;
		}

		for (const item of thread.slice(-6)) {
			// User message
			const userLines = renderMarkdownLines(item.question.trim(), width);
			lines.push(theme.fg("accent", theme.bold("You: ")) + (userLines[0] ?? ""));
			lines.push(...userLines.slice(1));
			lines.push("");

			// Tool calls (if any)
			if (item.toolCalls && item.toolCalls.length > 0) {
				lines.push(...renderToolCallLines(item.toolCalls, theme, width));
				lines.push("");
			}

			// Assistant message rendered as markdown
			const mdLines = renderMarkdownLines(item.answer, width);
			lines.push(theme.fg("success", theme.bold("Agent: ")) + (mdLines[0] ?? theme.fg("dim", "(no response)")));
			lines.push(...mdLines.slice(1));
			lines.push("");
		}

		if (pendingQuestion) {
			const userPendingLines = renderMarkdownLines(pendingQuestion.trim(), width);
			lines.push(theme.fg("accent", theme.bold("You: ")) + (userPendingLines[0] ?? ""));
			lines.push(...userPendingLines.slice(1));
			lines.push("");

			// Show tool calls inline
			if (pendingToolCalls.length > 0) {
				lines.push(...renderToolCallLines(pendingToolCalls, theme, width));
				lines.push("");
			}

			if (pendingError) {
				lines.push(theme.fg("error", `❌ ${pendingError}`));
			} else if (pendingAnswer) {
				const mdLines = renderMarkdownLines(pendingAnswer, width);
				lines.push(theme.fg("success", theme.bold("Agent: ")) + (mdLines[0] ?? theme.fg("dim", "(no response)")));
				lines.push(...mdLines.slice(1));
			} else if (pendingToolCalls.length === 0) {
				lines.push(theme.fg("dim", "…"));
			}
		}

		// Trim trailing empty line
		while (lines.length > 0 && lines[lines.length - 1] === "") {
			lines.pop();
		}
		return lines;
	}

	function syncOverlay(): void {
		overlayRuntime?.refresh?.();
	}

	function scheduleOverlayRefresh(): void {
		if (overlayRefreshTimer) {
			return;
		}

		overlayRefreshTimer = setTimeout(() => {
			overlayRefreshTimer = null;
			syncOverlay();
		}, 16);
	}

	function setOverlayStatus(status: string, throttled = false): void {
		overlayStatus = status;
		if (throttled) {
			scheduleOverlayRefresh();
		} else {
			syncOverlay();
		}
	}

	function dismissOverlay(): void {
		overlayRuntime?.close?.();
		overlayRuntime = null;
		if (overlayRefreshTimer) {
			clearTimeout(overlayRefreshTimer);
			overlayRefreshTimer = null;
		}
	}

	function setOverlayDraft(value: string): void {
		overlayDraft = value;
		overlayRuntime?.setDraft?.(value);
	}

	function recordLaunchAnchor(ctx: ExtensionContext | ExtensionCommandContext): void {
		const sidecar = ensureSidecarRuntime(ctx);
		if (!sidecar) {
			return;
		}

		launchAnchor = {
			leafId: ctx.sessionManager.getLeafId(),
			timestamp: Date.now(),
		};

		persistSidecarState(ctx, sidecar, {
			...sidecar.state,
			anchor: launchAnchor,
		});
	}

	async function performImport(ctx: ExtensionContext | ExtensionCommandContext): Promise<boolean> {
		try {
			const { source, leafId: targetLeafId } = resolveImportTarget(
				launchAnchor,
				ctx.sessionManager.getLeafId(),
				importedContextMessages !== null,
			);
			const sessionCtx = buildSessionContext(ctx.sessionManager.getEntries(), targetLeafId);
			const filtered = filterMessagesForBtw(sessionCtx.messages);

			if (filtered.length === 0) {
				notify(ctx, "No conversation context to import from main session.", "warning");
				return false;
			}

			const sidecar = ensureSidecarRuntime(ctx);
			if (!sidecar) {
				return false;
			}

			const timestamp = Date.now();
			const importedMessages = buildImportedContextMessages(filtered, timestamp, source);
			const details: BtwImportDetails = {
				messages: importedMessages,
				timestamp,
				messageCount: filtered.length,
				source,
			};

			appendSidecarEntry(sidecar, BTW_IMPORT_TYPE, details);
			persistSidecarState(ctx, sidecar, {
				...sidecar.state,
				importedContext: getImportedContextSummary(details),
			});

			importedContextMessages = importedMessages;
			importedContextTimestamp = timestamp;
			importedContextMessageCount = filtered.length;
			importedContextSource = source;

			await disposeSideSession();
			syncOverlay();
			return true;
		} catch (error) {
			notify(ctx, `Context import failed: ${error instanceof Error ? error.message : String(error)}`, "error");
			return false;
		}
	}

	async function importContextFromOverlay(ctx: ExtensionContext | ExtensionCommandContext): Promise<void> {
		if (sideBusy) {
			notify(ctx, "Cannot import context while BTW is processing.", "warning");
			return;
		}

		const isRefresh = importedContextMessages !== null;
		setOverlayStatus(isRefresh ? "Refreshing imported context..." : "Importing context...");

		const success = await performImport(ctx);
		if (success) {
			setOverlayStatus(isRefresh ? "Context refreshed." : "Context imported. Ask a question below.");
			notify(ctx, isRefresh ? "BTW context refreshed." : "Main session context imported into BTW.", "info");
		} else {
			setOverlayStatus(importedContextMessages !== null ? "Context refresh failed. Previous import still active." : "Ready");
		}

		syncOverlay();
	}

	async function disposeSideSession(): Promise<void> {
		const current = activeSideSession;
		activeSideSession = null;
		if (!current) {
			return;
		}

		try {
			current.unsubscribe();
		} catch {
			// Ignore unsubscribe errors during cleanup.
		}

		try {
			await current.session.abort();
		} catch {
			// Ignore abort errors during cleanup.
		}
		current.session.dispose();

		if (overlayRefreshTimer) {
			clearTimeout(overlayRefreshTimer);
			overlayRefreshTimer = null;
		}
	}

	async function resetThread(ctx: ExtensionContext | ExtensionCommandContext, persist = true): Promise<void> {
		if (sideBusy) {
			cancelledSideRequestId = sideRequestId;
		}
		thread = [];
		pendingQuestion = null;
		pendingAnswer = "";
		pendingError = null;
		pendingToolCalls = [];
		sideBusy = false;
		importedContextMessages = null;
		importedContextTimestamp = null;
		importedContextMessageCount = 0;
		importedContextSource = null;
		launchAnchor = null;
		setOverlayDraft("");
		setOverlayStatus("Ready");
		await disposeSideSession();
		if (persist) {
			const sidecar = ensureSidecarRuntime(ctx);
			const details: BtwResetDetails = { timestamp: Date.now() };
			if (sidecar) {
				appendSidecarEntry(sidecar, BTW_RESET_TYPE, details);
				persistSidecarState(ctx, sidecar, {
					...sidecar.state,
					anchor: undefined,
					importedContext: undefined,
				});
			}
		}
		syncOverlay();
	}

	async function restoreThread(ctx: ExtensionContext): Promise<void> {
		await disposeSideSession();
		thread = [];
		pendingQuestion = null;
		pendingAnswer = "";
		pendingError = null;
		pendingToolCalls = [];
		sideBusy = false;
		cancelledSideRequestId = null;
		overlayStatus = "Ready";
		overlayDraft = "";
		importedContextMessages = null;
		importedContextTimestamp = null;
		importedContextMessageCount = 0;
		importedContextSource = null;
		launchAnchor = null;

		const sidecar = ensureSidecarRuntime(ctx, { createIfMissing: false });
		if (sidecar) {
			const restored = restorePersistedState<BtwDetails, BtwImportDetails>(sidecar.sessionManager.getEntries(), {
				entryType: BTW_ENTRY_TYPE,
				resetType: BTW_RESET_TYPE,
				importType: BTW_IMPORT_TYPE,
				stateType: BTW_SIDECAR_STATE_TYPE,
			});
			applyRestoredState(
				restored,
				normalizeSidecarState(
					createBaseSidecarState(ctx.sessionManager.getSessionId(), getMainSessionFile(ctx)),
					restored.state ?? sidecar.state,
				),
			);
		} else {
			const restored = migrateLegacyInlineState(ctx);
			applyRestoredState(restored, restored.state);
		}

		syncOverlay();
	}

	async function createSideSession(ctx: ExtensionCommandContext): Promise<SideSessionRuntime | null> {
		if (!ctx.model) {
			return null;
		}

		const { session } = await createAgentSession({
			sessionManager: SessionManager.inMemory(ctx.cwd),
			model: ctx.model,
			modelRegistry: ctx.modelRegistry as AgentSession["modelRegistry"],
			thinkingLevel: pi.getThinkingLevel() as SessionThinkingLevel,
			resourceLoader: createBtwResourceLoader(ctx),
		});

		const seedMessages = buildSeedMessages(thread, importedContextMessages);
		if (seedMessages.length > 0) {
			session.agent.state.messages = seedMessages as typeof session.agent.state.messages;
		}

		const unsubscribe = session.subscribe((event: AgentSessionEvent) => {
			if (!sideBusy || !pendingQuestion) {
				return;
			}

			switch (event.type) {
				case "message_start":
				case "message_update":
				case "message_end": {
					const streamed = extractEventAssistantText(event.message);
					if (streamed) {
						pendingAnswer = streamed;
						pendingError = null;
					}
					setOverlayStatus(event.type === "message_end" ? "Finalizing side response..." : "Streaming side response...", true);
					return;
				}
				case "tool_execution_start": {
					const toolName = (event as { toolName?: string }).toolName ?? "unknown";
					try {
						pendingToolCalls.push({
							toolCallId: (event as { toolCallId?: string }).toolCallId ?? "",
							toolName,
							args: formatToolArgs(toolName, (event as { args?: unknown }).args),
							status: "running",
						});
					} catch {
						// Ignore tool tracking failures
					}
					setOverlayStatus(`Running tool: ${toolName}...`, true);
					return;
				}
				case "tool_execution_end": {
					const endToolCallId = (event as { toolCallId?: string }).toolCallId ?? "";
					const tc = pendingToolCalls.find(
						(t) => t.toolCallId === endToolCallId,
					);
					if (tc) {
						tc.status = (event as { isError?: boolean }).isError ? "error" : "done";
					}
					setOverlayStatus("Streaming side response...", true);
					return;
				}
				case "turn_end": {
					setOverlayStatus("Finalizing side response...", true);
					return;
				}
				default:
					return;
			}
		});

		return {
			session,
			modelKey: getModelKey(ctx),
			unsubscribe,
		};
	}

	async function ensureSideSession(ctx: ExtensionCommandContext): Promise<SideSessionRuntime | null> {
		if (!ctx.model) {
			return null;
		}

		const expectedModelKey = getModelKey(ctx);
		if (activeSideSession && activeSideSession.modelKey === expectedModelKey) {
			return activeSideSession;
		}

		await disposeSideSession();
		activeSideSession = await createSideSession(ctx);
		return activeSideSession;
	}

	async function ensureOverlay(ctx: ExtensionCommandContext | ExtensionContext): Promise<void> {
		if (!ctx.hasUI) {
			return;
		}

		if (overlayRuntime?.handle) {
			overlayRuntime.handle.setHidden(false);
			overlayRuntime.handle.focus();
			overlayRuntime.refresh?.();
			return;
		}

		const runtime: OverlayRuntime = {};
		const closeRuntime = () => {
			if (runtime.closed) {
				return;
			}
			runtime.closed = true;
			runtime.handle?.hide();
			if (overlayRuntime === runtime) {
				overlayRuntime = null;
			}
			runtime.finish?.();
		};
		runtime.close = closeRuntime;
		overlayRuntime = runtime;

		void ctx.ui
			.custom<void>(
				async (tui, theme, keybindings, done) => {
					runtime.finish = () => done();

					const overlay = new BtwOverlay(
						tui,
						theme,
						keybindings,
						(width, t) => getTranscriptLines(width, t),
						() => overlayStatus,
						() => getImportHint(),
						(value) => {
							void submitFromOverlay(ctx, value);
						},
						() => {
							void closeOverlayFlow(ctx);
						},
					);

					overlay.focused = true;
					overlay.setDraft(overlayDraft);
					runtime.setDraft = (value) => overlay.setDraft(value);
				runtime.resetScroll = () => overlay.resetScroll();
					runtime.refresh = () => {
						overlay.focused = runtime.handle?.isFocused() ?? false;
						tui.requestRender();
					};
					runtime.close = () => {
						overlayDraft = overlay.getDraft();
						closeRuntime();
					};

					if (runtime.closed) {
						done();
					}

					return overlay;
				},
				{
					overlay: true,
					overlayOptions: {
						width: "88%",
						minWidth: 72,
						maxHeight: "78%",
						anchor: "top-center",
						margin: { top: 1, left: 2, right: 2 },
					},
					onHandle: (handle) => {
						runtime.handle = handle;
						handle.focus();
						if (runtime.closed) {
							closeRuntime();
						}
					},
				},
			)
			.catch((error) => {
				if (overlayRuntime === runtime) {
					overlayRuntime = null;
				}
				notify(ctx, error instanceof Error ? error.message : String(error), "error");
			});
	}

	async function summarizeThread(ctx: ExtensionContext, items: BtwDetails[]): Promise<string> {
		const model = ctx.model;
		if (!model) {
			throw new Error("No active model selected.");
		}

		const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
		if (!auth.ok) {
			throw new Error(auth.error);
		}

		const { session } = await createAgentSession({
			sessionManager: SessionManager.inMemory(ctx.cwd),
			model,
			modelRegistry: ctx.modelRegistry as AgentSession["modelRegistry"],
			thinkingLevel: "off",
			tools: [],
			resourceLoader: createBtwResourceLoader(ctx, [BTW_SUMMARY_PROMPT]),
		});

		try {
			await session.prompt(formatThread(items), { source: "extension" });
			const response = getLastAssistantMessage(session);
			if (!response) {
				throw new Error("Summary finished without a response.");
			}
			if (response.stopReason === "aborted") {
				throw new Error("Summary request was aborted.");
			}
			if (response.stopReason === "error") {
				throw new Error(response.errorMessage || "Summary request failed.");
			}

			return extractText(response.content) || "(No summary generated)";
		} finally {
			try {
				await session.abort();
			} catch {
				// Ignore abort errors during temporary session teardown.
			}
			session.dispose();
		}
	}

	async function injectSummaryIntoMain(ctx: ExtensionContext | ExtensionCommandContext): Promise<void> {
		if (thread.length === 0) {
			notify(ctx, "No BTW thread to summarize.", "warning");
			return;
		}

		setOverlayStatus("Summarizing BTW thread for injection...");
		try {
			const summary = await summarizeThread(ctx, thread);
			const message = `Summary of my BTW side conversation:\n\n${summary}`;
			if (ctx.isIdle()) {
				pi.sendUserMessage(message);
			} else {
				pi.sendUserMessage(message, { deliverAs: "followUp" });
			}

			await resetThread(ctx);
			notify(ctx, "Injected BTW summary into main chat.", "info");
		} catch (error) {
			setOverlayStatus("Ready");
			notify(ctx, error instanceof Error ? error.message : String(error), "error");
		}
	}

	async function closeOverlayFlow(ctx: ExtensionContext | ExtensionCommandContext): Promise<void> {
		dismissOverlay();
		if (!ctx.hasUI) {
			return;
		}

		if (thread.length === 0) {
			return;
		}

		const choice = await ctx.ui.select("Close BTW:", [
			"Keep side thread",
			"Inject summary into main chat",
			"Discard side thread permanently",
		]);
		if (choice === "Inject summary into main chat") {
			await injectSummaryIntoMain(ctx);
		} else if (choice === "Discard side thread permanently") {
			await resetThread(ctx);
			notify(ctx, "Discarded BTW side thread.", "info");
		}
	}

	async function runBtwPrompt(ctx: ExtensionCommandContext, question: string): Promise<void> {
		const model = ctx.model;
		if (!model) {
			setOverlayStatus("No active model selected.");
			notify(ctx, "No active model selected.", "error");
			return;
		}

		const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
		if (!auth.ok) {
			const message = auth.error;
			setOverlayStatus(message);
			notify(ctx, message, "error");
			return;
		}

		if (sideBusy) {
			notify(ctx, "BTW is still processing the previous message.", "warning");
			return;
		}

		const side = await ensureSideSession(ctx);
		if (!side) {
			notify(ctx, "Unable to create BTW side session.", "error");
			return;
		}

		sideBusy = true;
		const requestId = ++sideRequestId;
		pendingQuestion = question;
		pendingAnswer = "";
		pendingError = null;
		pendingToolCalls = [];
		setOverlayStatus("Streaming side response...");
		syncOverlay();

		try {
			await side.session.prompt(question, { source: "extension" });
			if (cancelledSideRequestId === requestId) {
				return;
			}
			const response = getLastAssistantMessage(side.session);
			if (!response) {
				throw new Error("BTW request finished without a response.");
			}
			if (response.stopReason === "aborted") {
				throw new Error("BTW request aborted.");
			}
			if (response.stopReason === "error") {
				throw new Error(response.errorMessage || "BTW request failed.");
			}

			const answer = extractText(response.content) || "(No text response)";
			pendingAnswer = answer;
			const details: BtwDetails = {
				question,
				answer,
				timestamp: Date.now(),
				api: model.api,
				provider: model.provider,
				model: model.id,
				thinkingLevel: pi.getThinkingLevel() as SessionThinkingLevel,
				usage: response.usage,
				toolCalls: pendingToolCalls.length > 0 ? [...pendingToolCalls] : undefined,
			};
			thread.push(details);
			const sidecar = ensureSidecarRuntime(ctx);
			if (sidecar) {
				appendSidecarEntry(sidecar, BTW_ENTRY_TYPE, details);
			}

			pendingQuestion = null;
			pendingAnswer = "";
			pendingToolCalls = [];
			setOverlayStatus("Ready for the next side question.");
		} catch (error) {
			if (cancelledSideRequestId === requestId) {
				return;
			}
			const message = error instanceof Error ? error.message : String(error);
			pendingError = message;
			setOverlayStatus("BTW request failed.");
			notify(ctx, message, "error");
		} finally {
			if (cancelledSideRequestId === requestId) {
				cancelledSideRequestId = null;
			}
			if (requestId === sideRequestId) {
				sideBusy = false;
				syncOverlay();
			}
		}
	}

	async function submitFromOverlay(ctx: ExtensionContext | ExtensionCommandContext, rawValue: string): Promise<void> {
		const question = rawValue.trim();
		if (!question) {
			setOverlayStatus("Enter a question first.");
			return;
		}

		setOverlayDraft("");
		if (isImportOverlayCommand(question)) {
			await importContextFromOverlay(ctx);
			return;
		}
		if (isPartialImportOverlayCommand(question)) {
			setOverlayDraft(question);
			setOverlayStatus("Type /import alone to import or refresh context.");
			return;
		}
		if (!("waitForIdle" in ctx)) {
			setOverlayStatus("BTW submit requires command context. Re-open with /btw.");
			return;
		}

		// Scroll to bottom so the user sees their question and the response as it streams
		overlayRuntime?.resetScroll?.();
		await runBtwPrompt(ctx, question);
	}

	pi.registerCommand("btw", {
		description: "Open an isolated BTW side-chat popover. `/btw <text>` asks immediately, `/btw` opens the side thread.",
		handler: async (args, ctx) => {
			const question = args.trim();

			if (!question) {
				if (thread.length > 0 && ctx.hasUI) {
					const choice = await ctx.ui.select("BTW side chat:", [
						"Continue previous conversation",
						"Start fresh",
					]);
					if (choice === "Continue previous conversation") {
						recordLaunchAnchor(ctx);
						// Dispose the session so it is recreated from the saved BTW thread on next submit.
						await disposeSideSession();
						setOverlayStatus("Continuing BTW thread.");
						await ensureOverlay(ctx);
					} else if (choice === "Start fresh") {
						await resetThread(ctx, true);
						recordLaunchAnchor(ctx);
						setOverlayStatus("Ready");
						await ensureOverlay(ctx);
					}
					// null = user cancelled (Esc), do nothing
				} else {
					await resetThread(ctx, true);
					recordLaunchAnchor(ctx);
					setOverlayStatus("Ready");
					await ensureOverlay(ctx);
				}
				return;
			}

			recordLaunchAnchor(ctx);
			await ensureOverlay(ctx);
			await runBtwPrompt(ctx, question);
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		try {
			await restoreThread(ctx);
		} catch (error) {
			console.error("[btw] restoreThread failed on session_start:", error);
		}
	});

	pi.on("session_tree", async (_event, ctx) => {
		try {
			await restoreThread(ctx);
		} catch (error) {
			console.error("[btw] restoreThread failed on session_tree:", error);
		}
	});

	pi.on("session_shutdown", async () => {
		await disposeSideSession();
		dismissOverlay();
	});
}
