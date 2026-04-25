/**
 * Original source: https://github.com/mitsuhiko/agent-stuff/blob/main/extensions/todos.ts
 *
 * This extension stores todo items as files under <todo-dir> (defaults to .pi/todos,
 * or the path in PI_TODO_PATH).  Each todo is a standalone markdown file named
 * <id>.md and an optional <id>.lock file is used while a session is editing it.
 *
 * File format in .pi/todos:
 * - The file starts with a JSON object (not YAML) containing the front matter:
 *   { id, title, tags, status, created_at, assigned_to_session }
 * - After the JSON block comes optional markdown body text separated by a blank line.
 *
 * Todo storage settings are kept in <todo-dir>/settings.json.
 * Defaults: { "gc": true, "gcDays": 7 }
 *
 * Use `/todos` to bring up the visual todo manager or just let the LLM use them naturally.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text, TUI } from "@mariozechner/pi-tui";
import type { TodoAction, TodoRecord, TodoToolDetails } from "./types.ts";
import { TodoParams } from "./types.ts";
import {
	appendExpandHint,
	buildRefinePrompt,
	clearAssignmentIfClosed,
	formatTodoId,
	formatTodoList,
	getTodoPath,
	getTodosDir,
	getTodosDirLabel,
	normalizeTodoId,
	renderTodoDetail,
	renderTodoList,
	serializeTodoForAgent,
	serializeTodoListForAgent,
	splitTodosByAssignment,
	validateTodoId,
} from "./helpers.ts";
import {
	appendTodoBody,
	claimTodoAssignment,
	deleteTodo,
	ensureTodoExists,
	ensureTodosDir,
	garbageCollectTodos,
	generateTodoId,
	listTodos,
	readTodoSettings,
	releaseTodoAssignment,
	updateTodoStatus,
	withTodoLock,
	writeTodoFile,
} from "./storage.ts";
import {
	TodoActionMenuComponent,
	TodoDeleteConfirmComponent,
	TodoDetailOverlayComponent,
	TodoSelectorComponent,
	copyTodoPathToClipboard,
	copyTodoTextToClipboard,
} from "./components.ts";

export default function todosExtension(pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		const todosDir = getTodosDir(ctx.cwd);
		await ensureTodosDir(todosDir);
		const settings = await readTodoSettings(todosDir);
		await garbageCollectTodos(todosDir, settings);
	});

	const todosDirLabel = getTodosDirLabel(process.cwd());

	pi.registerTool({
		name: "todo",
		label: "Todo",
		description:
			`Manage file-based todos in ${todosDirLabel} (list, list-all, get, create, update, append, delete, claim, release). ` +
			"Title is the short summary; body is long-form markdown notes (update replaces, append adds). " +
			"Todo ids are shown as TODO-<hex>; id parameters accept TODO-<hex> or the raw hex filename. " +
			"Claim tasks before working on them to avoid conflicts, and close them when complete.",
		parameters: TodoParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const todosDir = getTodosDir(ctx.cwd);
			const action: TodoAction = params.action;

			switch (action) {
				case "list": {
					const todos = await listTodos(todosDir);
					const { assignedTodos, openTodos } = splitTodosByAssignment(todos);
					const listedTodos = [...assignedTodos, ...openTodos];
					const currentSessionId = ctx.sessionManager.getSessionId();
					return {
						content: [{ type: "text", text: serializeTodoListForAgent(listedTodos) }],
						details: { action: "list", todos: listedTodos, currentSessionId },
					};
				}

				case "list-all": {
					const todos = await listTodos(todosDir);
					const currentSessionId = ctx.sessionManager.getSessionId();
					return {
						content: [{ type: "text", text: serializeTodoListForAgent(todos) }],
						details: { action: "list-all", todos, currentSessionId },
					};
				}

				case "get": {
					if (!params.id) {
						return {
							content: [{ type: "text", text: "Error: id required" }],
							details: { action: "get", error: "id required" },
						};
					}
					const validated = validateTodoId(params.id);
					if ("error" in validated) {
						return {
							content: [{ type: "text", text: validated.error }],
							details: { action: "get", error: validated.error },
						};
					}
					const normalizedId = validated.id;
					const displayId = formatTodoId(normalizedId);
					const filePath = getTodoPath(todosDir, normalizedId);
					const todo = await ensureTodoExists(filePath, normalizedId);
					if (!todo) {
						return {
							content: [{ type: "text", text: `Todo ${displayId} not found` }],
							details: { action: "get", error: "not found" },
						};
					}
					return {
						content: [{ type: "text", text: serializeTodoForAgent(todo) }],
						details: { action: "get", todo },
					};
				}

				case "create": {
					if (!params.title) {
						return {
							content: [{ type: "text", text: "Error: title required" }],
							details: { action: "create", error: "title required" },
						};
					}
					await ensureTodosDir(todosDir);
					const id = await generateTodoId(todosDir);
					const filePath = getTodoPath(todosDir, id);
					const todo: TodoRecord = {
						id,
						title: params.title,
						tags: params.tags ?? [],
						status: params.status ?? "open",
						created_at: new Date().toISOString(),
						body: params.body ?? "",
					};

					const result = await withTodoLock(todosDir, id, ctx, async () => {
						await writeTodoFile(filePath, todo);
						return todo;
					});

					if (typeof result === "object" && "error" in result) {
						return {
							content: [{ type: "text", text: result.error }],
							details: { action: "create", error: result.error },
						};
					}

					return {
						content: [{ type: "text", text: serializeTodoForAgent(todo) }],
						details: { action: "create", todo },
					};
				}

				case "update": {
					if (!params.id) {
						return {
							content: [{ type: "text", text: "Error: id required" }],
							details: { action: "update", error: "id required" },
						};
					}
					const validated = validateTodoId(params.id);
					if ("error" in validated) {
						return {
							content: [{ type: "text", text: validated.error }],
							details: { action: "update", error: validated.error },
						};
					}
					const normalizedId = validated.id;
					const displayId = formatTodoId(normalizedId);
					const filePath = getTodoPath(todosDir, normalizedId);
					if (!existsSync(filePath)) {
						return {
							content: [{ type: "text", text: `Todo ${displayId} not found` }],
							details: { action: "update", error: "not found" },
						};
					}
					const result = await withTodoLock(todosDir, normalizedId, ctx, async () => {
						const existing = await ensureTodoExists(filePath, normalizedId);
						if (!existing) return { error: `Todo ${displayId} not found` } as const;

						existing.id = normalizedId;
						if (params.title !== undefined) existing.title = params.title;
						if (params.status !== undefined) existing.status = params.status;
						if (params.tags !== undefined) existing.tags = params.tags;
						if (params.body !== undefined) existing.body = params.body;
						if (!existing.created_at) existing.created_at = new Date().toISOString();
						clearAssignmentIfClosed(existing);

						await writeTodoFile(filePath, existing);
						return existing;
					});

					if (typeof result === "object" && "error" in result) {
						return {
							content: [{ type: "text", text: result.error }],
							details: { action: "update", error: result.error },
						};
					}

					const updatedTodo = result as TodoRecord;
					return {
						content: [{ type: "text", text: serializeTodoForAgent(updatedTodo) }],
						details: { action: "update", todo: updatedTodo },
					};
				}

				case "append": {
					if (!params.id) {
						return {
							content: [{ type: "text", text: "Error: id required" }],
							details: { action: "append", error: "id required" },
						};
					}
					const validated = validateTodoId(params.id);
					if ("error" in validated) {
						return {
							content: [{ type: "text", text: validated.error }],
							details: { action: "append", error: validated.error },
						};
					}
					const normalizedId = validated.id;
					const displayId = formatTodoId(normalizedId);
					const filePath = getTodoPath(todosDir, normalizedId);
					if (!existsSync(filePath)) {
						return {
							content: [{ type: "text", text: `Todo ${displayId} not found` }],
							details: { action: "append", error: "not found" },
						};
					}
					const result = await withTodoLock(todosDir, normalizedId, ctx, async () => {
						const existing = await ensureTodoExists(filePath, normalizedId);
						if (!existing) return { error: `Todo ${displayId} not found` } as const;
						if (!params.body || !params.body.trim()) {
							return existing;
						}
						const updated = await appendTodoBody(filePath, existing, params.body);
						return updated;
					});

					if (typeof result === "object" && "error" in result) {
						return {
							content: [{ type: "text", text: result.error }],
							details: { action: "append", error: result.error },
						};
					}

					const updatedTodo = result as TodoRecord;
					return {
						content: [{ type: "text", text: serializeTodoForAgent(updatedTodo) }],
						details: { action: "append", todo: updatedTodo },
					};
				}

				case "claim": {
					if (!params.id) {
						return {
							content: [{ type: "text", text: "Error: id required" }],
							details: { action: "claim", error: "id required" },
						};
					}
					const result = await claimTodoAssignment(
						todosDir,
						params.id,
						ctx,
						Boolean(params.force),
					);
					if (typeof result === "object" && "error" in result) {
						return {
							content: [{ type: "text", text: result.error }],
							details: { action: "claim", error: result.error },
						};
					}
					const updatedTodo = result as TodoRecord;
					return {
						content: [{ type: "text", text: serializeTodoForAgent(updatedTodo) }],
						details: { action: "claim", todo: updatedTodo },
					};
				}

				case "release": {
					if (!params.id) {
						return {
							content: [{ type: "text", text: "Error: id required" }],
							details: { action: "release", error: "id required" },
						};
					}
					const result = await releaseTodoAssignment(
						todosDir,
						params.id,
						ctx,
						Boolean(params.force),
					);
					if (typeof result === "object" && "error" in result) {
						return {
							content: [{ type: "text", text: result.error }],
							details: { action: "release", error: result.error },
						};
					}
					const updatedTodo = result as TodoRecord;
					return {
						content: [{ type: "text", text: serializeTodoForAgent(updatedTodo) }],
						details: { action: "release", todo: updatedTodo },
					};
				}

				case "delete": {
					if (!params.id) {
						return {
							content: [{ type: "text", text: "Error: id required" }],
							details: { action: "delete", error: "id required" },
						};
					}

					const validated = validateTodoId(params.id);
					if ("error" in validated) {
						return {
							content: [{ type: "text", text: validated.error }],
							details: { action: "delete", error: validated.error },
						};
					}
					const result = await deleteTodo(todosDir, validated.id, ctx);
					if (typeof result === "object" && "error" in result) {
						return {
							content: [{ type: "text", text: result.error }],
							details: { action: "delete", error: result.error },
						};
					}

					return {
						content: [
							{ type: "text", text: serializeTodoForAgent(result as TodoRecord) },
						],
						details: { action: "delete", todo: result as TodoRecord },
					};
				}
			}
		},

		renderCall(args, theme) {
			const action = typeof args.action === "string" ? args.action : "";
			const id = typeof args.id === "string" ? args.id : "";
			const normalizedId = id ? normalizeTodoId(id) : "";
			const title = typeof args.title === "string" ? args.title : "";
			let text =
				theme.fg("toolTitle", theme.bold("todo ")) + theme.fg("muted", action);
			if (normalizedId) {
				text += " " + theme.fg("accent", formatTodoId(normalizedId));
			}
			if (title) {
				text += " " + theme.fg("dim", `"${title}"`);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as TodoToolDetails | undefined;
			if (isPartial) {
				return new Text(theme.fg("warning", "Processing..."), 0, 0);
			}
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			if (details.error) {
				return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
			}

			if (details.action === "list" || details.action === "list-all") {
				let text = renderTodoList(
					theme,
					details.todos,
					expanded,
					details.currentSessionId,
				);
				if (!expanded) {
					const { closedTodos } = splitTodosByAssignment(details.todos);
					if (closedTodos.length) {
						text = appendExpandHint(theme, text);
					}
				}
				return new Text(text, 0, 0);
			}

			if (!("todo" in details)) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			let text = renderTodoDetail(theme, details.todo, expanded);
			const actionLabel =
				details.action === "create"
					? "Created"
					: details.action === "update"
						? "Updated"
						: details.action === "append"
							? "Appended to"
							: details.action === "delete"
								? "Deleted"
								: details.action === "claim"
									? "Claimed"
									: details.action === "release"
										? "Released"
										: null;
			if (actionLabel) {
				const lines = text.split("\n");
				lines[0] =
					theme.fg("success", "✓ ") +
					theme.fg("muted", `${actionLabel} `) +
					lines[0];
				text = lines.join("\n");
			}
			if (!expanded) {
				text = appendExpandHint(theme, text);
			}
			return new Text(text, 0, 0);
		},
	});

	pi.registerCommand("todos", {
		description: "List todos from .pi/todos",
		handler: async (args, ctx) => {
			const todosDir = getTodosDir(ctx.cwd);
			const todos = await listTodos(todosDir);
			const currentSessionId = ctx.sessionManager.getSessionId();
			const searchTerm = (args ?? "").trim();

			if (!ctx.hasUI) {
				const text = formatTodoList(todos);
				console.log(text);
				return;
			}

			let nextPrompt: string | null = null;
			let rootTui: TUI | null = null;
			await ctx.ui.custom<void>((tui, theme, keybindings, done) => {
				rootTui = tui;
				let selector: TodoSelectorComponent | null = null;
				let actionMenu: TodoActionMenuComponent | null = null;
				let deleteConfirm: TodoDeleteConfirmComponent | null = null;
				let activeComponent:
					| {
							render: (width: number) => string[];
							invalidate: () => void;
							handleInput?: (data: string) => void;
							focused?: boolean;
					  }
					| null = null;
				let wrapperFocused = false;

				const setActiveComponent = (
					component:
						| {
								render: (width: number) => string[];
								invalidate: () => void;
								handleInput?: (data: string) => void;
								focused?: boolean;
						  }
						| null,
				) => {
					if (activeComponent && "focused" in activeComponent) {
						activeComponent.focused = false;
					}
					activeComponent = component;
					if (activeComponent && "focused" in activeComponent) {
						activeComponent.focused = wrapperFocused;
					}
					tui.requestRender();
				};

				const resolveTodoRecord = async (
					todo: import("./types.ts").TodoFrontMatter,
				): Promise<TodoRecord | null> => {
					const filePath = getTodoPath(todosDir, todo.id);
					const record = await ensureTodoExists(filePath, todo.id);
					if (!record) {
						ctx.ui.notify(`Todo ${formatTodoId(todo.id)} not found`, "error");
						return null;
					}
					return record;
				};

				const openTodoOverlay = async (
					record: TodoRecord,
				): Promise<import("./types.ts").TodoOverlayAction> => {
					const action = await ctx.ui.custom<import("./types.ts").TodoOverlayAction>(
						(overlayTui, overlayTheme, overlayKeybindings, overlayDone) =>
							new TodoDetailOverlayComponent(
								overlayTui,
								overlayTheme,
								overlayKeybindings,
								record,
								overlayDone,
							),
						{
							overlay: true,
							overlayOptions: {
								width: "80%",
								maxHeight: "80%",
								anchor: "center",
							},
						},
					);

					return action ?? "back";
				};

				const applyTodoAction = async (
					record: TodoRecord,
					action: import("./types.ts").TodoMenuAction,
				): Promise<"stay" | "exit"> => {
					if (action === "refine") {
						const title = record.title || "(untitled)";
						nextPrompt = buildRefinePrompt(record.id, title);
						done();
						return "exit";
					}
					if (action === "work") {
						const title = record.title || "(untitled)";
						nextPrompt = `work on todo ${formatTodoId(record.id)} "${title}"`;
						done();
						return "exit";
					}
					if (action === "view") {
						return "stay";
					}
					if (action === "copyPath") {
						copyTodoPathToClipboard(todosDir, record.id, (msg, type) =>
							ctx.ui.notify(msg, type),
						);
						return "stay";
					}
					if (action === "copyText") {
						copyTodoTextToClipboard(record, (msg, type) =>
							ctx.ui.notify(msg, type),
						);
						return "stay";
					}

					if (action === "release") {
						const result = await releaseTodoAssignment(
							todosDir,
							record.id,
							ctx,
							true,
						);
						if ("error" in result) {
							ctx.ui.notify(result.error, "error");
							return "stay";
						}
						const updatedTodos = await listTodos(todosDir);
						selector?.setTodos(updatedTodos);
						ctx.ui.notify(`Released todo ${formatTodoId(record.id)}`, "info");
						return "stay";
					}

					if (action === "delete") {
						const result = await deleteTodo(todosDir, record.id, ctx);
						if ("error" in result) {
							ctx.ui.notify(result.error, "error");
							return "stay";
						}
						const updatedTodos = await listTodos(todosDir);
						selector?.setTodos(updatedTodos);
						ctx.ui.notify(`Deleted todo ${formatTodoId(record.id)}`, "info");
						return "stay";
					}

					const nextStatus = action === "close" ? "closed" : "open";
					const result = await updateTodoStatus(
						todosDir,
						record.id,
						nextStatus,
						ctx,
					);
					if ("error" in result) {
						ctx.ui.notify(result.error, "error");
						return "stay";
					}

					const updatedTodos = await listTodos(todosDir);
					selector?.setTodos(updatedTodos);
					ctx.ui.notify(
						`${action === "close" ? "Closed" : "Reopened"} todo ${formatTodoId(record.id)}`,
						"info",
					);
					return "stay";
				};

				const handleActionSelection = async (
					record: TodoRecord,
					action: import("./types.ts").TodoMenuAction,
				) => {
					if (action === "view") {
						const overlayAction = await openTodoOverlay(record);
						if (overlayAction === "work") {
							await applyTodoAction(record, "work");
							return;
						}
						if (actionMenu) {
							setActiveComponent(actionMenu);
						}
						return;
					}

					if (action === "delete") {
						const message = `Delete todo ${formatTodoId(record.id)}? This cannot be undone.`;
						deleteConfirm = new TodoDeleteConfirmComponent(
							theme,
							message,
							(confirmed) => {
								if (!confirmed) {
									setActiveComponent(actionMenu);
									return;
								}
								void (async () => {
									await applyTodoAction(record, "delete");
									setActiveComponent(selector);
								})();
							},
						);
						setActiveComponent(deleteConfirm);
						return;
					}

					const result = await applyTodoAction(record, action);
					if (result === "stay") {
						setActiveComponent(selector);
					}
				};

				const showActionMenu = async (
					todo: import("./types.ts").TodoFrontMatter | TodoRecord,
				) => {
					const record = "body" in todo ? todo : await resolveTodoRecord(todo);
					if (!record) return;
					actionMenu = new TodoActionMenuComponent(
						theme,
						record,
						(action) => {
							void handleActionSelection(record, action);
						},
						() => {
							setActiveComponent(selector);
						},
					);
					setActiveComponent(actionMenu);
				};

				const handleSelect = async (
					todo: import("./types.ts").TodoFrontMatter,
				) => {
					await showActionMenu(todo);
				};

				selector = new TodoSelectorComponent(
					tui,
					theme,
					keybindings,
					todos,
					(todo) => {
						void handleSelect(todo);
					},
					() => done(),
					searchTerm || undefined,
					currentSessionId,
					(todo, action) => {
						const title = todo.title || "(untitled)";
						nextPrompt =
							action === "refine"
								? buildRefinePrompt(todo.id, title)
								: `work on todo ${formatTodoId(todo.id)} "${title}"`;
						done();
					},
				);

				setActiveComponent(selector);

				const rootComponent = {
					get focused() {
						return wrapperFocused;
					},
					set focused(value: boolean) {
						wrapperFocused = value;
						if (activeComponent && "focused" in activeComponent) {
							activeComponent.focused = value;
						}
					},
					render(width: number) {
						return activeComponent ? activeComponent.render(width) : [];
					},
					invalidate() {
						activeComponent?.invalidate();
					},
					handleInput(data: string) {
						activeComponent?.handleInput?.(data);
					},
				};

				return rootComponent;
			});

			if (nextPrompt) {
				ctx.ui.setEditorText(nextPrompt);
				(rootTui as TUI | null)?.requestRender();
			}
		},
	});
}
