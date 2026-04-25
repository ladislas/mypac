/**
 * Shared types, interfaces, constants, and the tool parameter schema for todos.
 */
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "typebox";

// ─── Constants ────────────────────────────────────────────────────────────────

export const TODO_DIR_NAME = ".pi/todos";
export const TODO_PATH_ENV = "PI_TODO_PATH";
export const TODO_SETTINGS_NAME = "settings.json";
export const TODO_ID_PREFIX = "TODO-";
export const TODO_ID_PATTERN = /^[a-f0-9]{8}$/i;
export const DEFAULT_TODO_SETTINGS: TodoSettings = {
	gc: true,
	gcDays: 7,
};
export const LOCK_TTL_MS = 30 * 60 * 1000;

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface TodoFrontMatter {
	id: string;
	title: string;
	tags: string[];
	status: string;
	created_at: string;
	assigned_to_session?: string;
}

export interface TodoRecord extends TodoFrontMatter {
	body: string;
}

export interface LockInfo {
	id: string;
	pid: number;
	session?: string | null;
	created_at: string;
}

export interface TodoSettings {
	gc: boolean;
	gcDays: number;
}

// ─── Action/Detail types ──────────────────────────────────────────────────────

export type TodoAction =
	| "list"
	| "list-all"
	| "get"
	| "create"
	| "update"
	| "append"
	| "delete"
	| "claim"
	| "release";

export type TodoOverlayAction = "back" | "work";

export type TodoMenuAction =
	| "work"
	| "refine"
	| "close"
	| "reopen"
	| "release"
	| "delete"
	| "copyPath"
	| "copyText"
	| "view";

export type TodoToolDetails =
	| {
			action: "list" | "list-all";
			todos: TodoFrontMatter[];
			currentSessionId?: string;
			error?: string;
	  }
	| {
			action: "get" | "create" | "update" | "append" | "delete" | "claim" | "release";
			todo: TodoRecord;
			error?: string;
	  };

// ─── Tool parameter schema ────────────────────────────────────────────────────

export const TodoParams = Type.Object({
	action: StringEnum(
		["list", "list-all", "get", "create", "update", "append", "delete", "claim", "release"] as const,
	),
	id: Type.Optional(
		Type.String({ description: "Todo id (TODO-<hex> or raw hex filename)" }),
	),
	title: Type.Optional(Type.String({ description: "Short summary shown in lists" })),
	status: Type.Optional(Type.String({ description: "Todo status" })),
	tags: Type.Optional(Type.Array(Type.String({ description: "Todo tag" }))),
	body: Type.Optional(
		Type.String({ description: "Long-form details (markdown). Update replaces; append adds." }),
	),
	force: Type.Optional(Type.Boolean({ description: "Override another session's assignment" })),
});
