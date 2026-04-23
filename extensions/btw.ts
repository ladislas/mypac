/**
 * Original source: https://github.com/mitsuhiko/agent-stuff/blob/main/extensions/btw.ts
 */
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
	matchesKey,
	Markdown,
	truncateToWidth,
	visibleWidth,
	type EditorTheme,
	type Focusable,
	type KeybindingsManager,
	type OverlayHandle,
	type TUI,
} from "@mariozechner/pi-tui";

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

type OverlayRuntime = {
	handle?: OverlayHandle;
	refresh?: () => void;
	close?: () => void;
	finish?: () => void;
	setDraft?: (value: string) => void;
	closed?: boolean;
};

type SideSessionRuntime = {
	session: AgentSession;
	modelKey: string;
	unsubscribe: () => void;
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

function buildSeedMessages(thread: BtwDetails[]): Message[] {
	const seed: Message[] = [];

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


class BtwOverlay extends Container implements Focusable {
	private readonly editor: Editor;
	private readonly tui: TUI;
	private readonly theme: ExtensionContext["ui"]["theme"];
	private readonly keybindings: KeybindingsManager;
	private readonly getTranscript: (width: number, theme: ExtensionContext["ui"]["theme"]) => string[];
	private readonly getStatus: () => string;
	private readonly onSubmitCallback: (value: string) => void;
	private readonly onDismissCallback: () => void;
	private readonly onImportContextCallback: () => void;
	private _focused = false;

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
		onSubmit: (value: string) => void,
		onDismiss: () => void,
		onImportContext: () => void,
	) {
		super();
		this.tui = tui;
		this.theme = theme;
		this.keybindings = keybindings;
		this.getTranscript = getTranscript;
		this.getStatus = getStatus;
		this.onSubmitCallback = onSubmit;
		this.onDismissCallback = onDismiss;
		this.onImportContextCallback = onImportContext;

		const editorTheme: EditorTheme = {
			borderColor: (s) => theme.fg("borderMuted", s),
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

	handleInput(data: string): void {
		if (this.keybindings.matches(data, "tui.select.cancel")) {
			this.onDismissCallback();
			return;
		}

		if (matchesKey(data, "alt+i")) {
			this.onImportContextCallback();
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
		return `${this.theme.fg("borderMuted", "│")}${truncated}${" ".repeat(padding)}${this.theme.fg("borderMuted", "│")}`;
	}

	private borderLine(innerWidth: number, edge: "top" | "bottom"): string {
		const left = edge === "top" ? "┌" : "└";
		const right = edge === "top" ? "┐" : "┘";
		return this.theme.fg("borderMuted", `${left}${"─".repeat(innerWidth)}${right}`);
	}

	override render(width: number): string[] {
		const dialogWidth = Math.max(56, Math.min(width, Math.floor(width * 0.9)));
		const innerWidth = Math.max(40, dialogWidth - 2);
		const terminalRows = process.stdout.rows ?? 30;
		const dialogHeight = Math.max(16, Math.min(30, Math.floor(terminalRows * 0.75)));

		// Render editor first so we know how many lines it occupies
		const editorLines = this.editor.render(innerWidth);

		// Static chrome: top border + title + subtitle + 2 separators + status + hints + bottom border
		const staticChrome = 8;
		const transcriptHeight = Math.max(4, dialogHeight - staticChrome - editorLines.length);

		// Markdown renders to innerWidth already — no manual wrapping needed
		const transcript = this.getTranscript(innerWidth, this.theme);
		const visibleTranscript = transcript.slice(-transcriptHeight);
		const transcriptPadding = Math.max(0, transcriptHeight - visibleTranscript.length);

		const status = this.getStatus();

		const lines = [
			this.borderLine(innerWidth, "top"),
			this.frameLine(this.theme.fg("accent", this.theme.bold(" BTW side chat ")), innerWidth),
			this.frameLine(this.theme.fg("dim", "Isolated side conversation. Alt+I to import context."), innerWidth),
			this.theme.fg("borderMuted", `├${"─".repeat(innerWidth)}┤`),
		];

		for (const line of visibleTranscript) {
			lines.push(this.frameLine(line, innerWidth));
		}
		for (let i = 0; i < transcriptPadding; i++) {
			lines.push(this.frameLine("", innerWidth));
		}

		lines.push(this.theme.fg("borderMuted", `├${"─".repeat(innerWidth)}┤`));
		lines.push(this.frameLine(this.theme.fg("warning", status), innerWidth));
		for (const line of editorLines) {
			lines.push(this.frameLine(line, innerWidth));
		}
		lines.push(this.frameLine(this.theme.fg("dim", "Enter submit · Shift+Enter newline · Alt+I import · Esc close"), innerWidth));
		lines.push(this.borderLine(innerWidth, "bottom"));

		return lines;
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
	let overlayRefreshTimer: ReturnType<typeof setTimeout> | null = null;
	let importedContextSection: string | null = null;
	let importedContextTimestamp: number | null = null;
	let importedContextMessageCount = 0;

	const mdTheme = getMarkdownTheme();

	function getModelKey(ctx: ExtensionContext): string {
		const model = ctx.model;
		return model ? `${model.provider}/${model.id}` : "none";
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

	function filterMessagesForBtw(messages: Message[]): Message[] {
		return messages.filter((msg) => msg.role !== "toolResult");
	}

	function formatImportedContextSection(messages: Message[], timestamp: number): string {
		const MAX_CHARS = 15000;
		const dateStr = new Date(timestamp).toISOString();
		const header = `<imported-main-context timestamp="${dateStr}">\nSnapshot of the main conversation imported at your request. Use as reference for this BTW discussion.\n\n`;
		const footer = `</imported-main-context>`;
		const TRUNCATED_MARKER = "[...older context omitted...]\n\n";

		// Build each message as a standalone block string (oldest first)
		const blocks: string[] = [];
		for (const msg of messages) {
			if (msg.role === "user") {
				const content = (msg as { role: "user"; content: string | Array<{ type: string; text?: string }> }).content;
				const text =
					typeof content === "string"
						? content.trim()
						: (content as Array<{ type: string; text?: string }>)
								.filter((p) => p.type === "text")
								.map((p) => p.text ?? "")
								.join("\n")
								.trim();
				if (text) {
					blocks.push(`[User]: ${text}\n`);
				}
			} else if (msg.role === "assistant") {
				const assistantMsg = msg as AssistantMessage;
				const lines: string[] = [];
				for (const part of assistantMsg.content) {
					if (part.type === "text") {
						const textPart = part as { type: "text"; text: string };
						if (textPart.text.trim()) {
							lines.push(textPart.text.trim());
						}
					} else if (part.type === "toolCall") {
						const tc = part as { type: "toolCall"; name: string; arguments: Record<string, unknown> };
						const argSummary = formatToolArgs(tc.name, tc.arguments);
						lines.push(`[Tool: ${tc.name}${argSummary ? ` ${argSummary}` : ""}]`);
					}
					// Skip "thinking" parts
				}
				const text = lines.join("\n").trim();
				if (text) {
					blocks.push(`[Assistant]: ${text}\n`);
				}
			}
		}

		// Drop oldest blocks until header + body + footer fits within MAX_CHARS.
		// This keeps the newest (most relevant) messages when truncation is needed.
		let truncated = false;
		while (blocks.length > 0) {
			const body = (truncated ? TRUNCATED_MARKER : "") + blocks.join("\n");
			if (header.length + body.length + footer.length <= MAX_CHARS) {
				break;
			}
			blocks.shift();
			truncated = true;
		}

		const body = (truncated ? TRUNCATED_MARKER : "") + blocks.join("\n");
		return header + body + footer;
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

		// Show import marker at top when context is imported
		if (importedContextSection !== null && importedContextTimestamp !== null) {
			const time = new Date(importedContextTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			const countStr = importedContextMessageCount > 0 ? ` · ${importedContextMessageCount} msgs` : "";
			lines.push(theme.fg("dim", `↑ context from main session (${time}${countStr})`));
			lines.push("");
		}

		if (thread.length === 0 && !pendingQuestion && !pendingAnswer && !pendingError) {
			lines.push(
				theme.fg(
					"dim",
					importedContextSection !== null
						? "Main session context imported. Ask a question below."
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

	async function performImport(ctx: ExtensionContext | ExtensionCommandContext): Promise<boolean> {
		try {
			const entries = ctx.sessionManager.getBranch();
			const sessionCtx = buildSessionContext(entries);
			const rawMessages = convertToLlm(sessionCtx.messages);
			const filtered = filterMessagesForBtw(rawMessages);

			if (filtered.length === 0) {
				notify(ctx, "No conversation context to import from main session.", "warning");
				return false;
			}

			const timestamp = Date.now();
			const section = formatImportedContextSection(filtered, timestamp);
			importedContextSection = section;
			importedContextTimestamp = timestamp;
			importedContextMessageCount = filtered.length;

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

		const isRefresh = importedContextSection !== null;
		setOverlayStatus(isRefresh ? "Refreshing imported context..." : "Importing context...");

		const success = await performImport(ctx);
		if (success) {
			setOverlayStatus(isRefresh ? "Context refreshed." : "Context imported. Ask a question below.");
			notify(ctx, isRefresh ? "BTW context refreshed." : "Main session context imported into BTW.", "info");
		} else {
			setOverlayStatus(importedContextSection !== null ? "Context refresh failed. Previous import still active." : "Ready");
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
		importedContextSection = null;
		importedContextTimestamp = null;
		importedContextMessageCount = 0;
		setOverlayDraft("");
		setOverlayStatus("Ready");
		await disposeSideSession();
		if (persist) {
			const details: BtwResetDetails = { timestamp: Date.now() };
			pi.appendEntry(BTW_RESET_TYPE, details);
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
		importedContextSection = null;
		importedContextTimestamp = null;
		importedContextMessageCount = 0;
		const branch = ctx.sessionManager.getBranch();
		let lastResetIndex = -1;
		for (let i = 0; i < branch.length; i++) {
			const entry = branch[i];
			if (entry.type === "custom" && entry.customType === BTW_RESET_TYPE) {
				lastResetIndex = i;
			}
		}

		for (const entry of branch.slice(lastResetIndex + 1)) {
			if (entry.type !== "custom") {
				continue;
			}
			if (entry.customType === BTW_ENTRY_TYPE) {
				const details = entry.data as BtwDetails | undefined;
				if (!details?.question || !details.answer) {
					continue;
				}
				thread.push(details);
			}
		}

		syncOverlay();
	}

	async function createSideSession(ctx: ExtensionCommandContext): Promise<SideSessionRuntime | null> {
		if (!ctx.model) {
			return null;
		}

		const appendSP: string[] =
			importedContextSection !== null
				? [BTW_SYSTEM_PROMPT, importedContextSection]
				: [BTW_SYSTEM_PROMPT];

		const { session } = await createAgentSession({
			sessionManager: SessionManager.inMemory(ctx.cwd),
			model: ctx.model,
			modelRegistry: ctx.modelRegistry as AgentSession["modelRegistry"],
			thinkingLevel: pi.getThinkingLevel() as SessionThinkingLevel,
			resourceLoader: createBtwResourceLoader(ctx, appendSP),
		});

		const seedMessages = buildSeedMessages(thread);
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
						(value) => {
							void submitFromOverlay(ctx, value);
						},
						() => {
							void closeOverlayFlow(ctx);
						},
						() => {
							void importContextFromOverlay(ctx);
						},
					);

					overlay.focused = true;
					overlay.setDraft(overlayDraft);
					runtime.setDraft = (value) => overlay.setDraft(value);
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
						width: "80%",
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
			pi.appendEntry(BTW_ENTRY_TYPE, details);

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
		if (!("waitForIdle" in ctx)) {
			setOverlayStatus("BTW submit requires command context. Re-open with /btw.");
			return;
		}

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
						// Dispose the session so it is recreated from the saved BTW thread on next submit.
						await disposeSideSession();
						setOverlayStatus("Continuing BTW thread.");
						await ensureOverlay(ctx);
					} else if (choice === "Start fresh") {
						await resetThread(ctx, true);
						setOverlayStatus("Ready");
						await ensureOverlay(ctx);
					}
					// null = user cancelled (Esc), do nothing
				} else {
					await resetThread(ctx, true);
					setOverlayStatus("Ready");
					await ensureOverlay(ctx);
				}
				return;
			}

			await ensureOverlay(ctx);
			await runBtwPrompt(ctx, question);
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		await restoreThread(ctx);
	});


	pi.on("session_tree", async (_event, ctx) => {
		await restoreThread(ctx);
	});

	pi.on("session_shutdown", async () => {
		await disposeSideSession();
		dismissOverlay();
	});
}
