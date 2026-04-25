import test from "node:test";
import assert from "node:assert/strict";
import {
	formatTodoId,
	normalizeTodoId,
	validateTodoId,
	displayTodoId,
	isTodoClosed,
	sortTodos,
	filterTodos,
	formatTodoHeading,
	formatTodoList,
	splitTodosByAssignment,
	serializeTodoForAgent,
	serializeTodoListForAgent,
	buildRefinePrompt,
	getTodoPath,
	getLockPath,
} from "./helpers.ts";
import {
	parseFrontMatter,
	splitFrontMatter,
	parseTodoContent,
	serializeTodo,
	normalizeTodoSettings,
} from "./storage.ts";

// ─── ID helpers ───────────────────────────────────────────────────────────────

test("formatTodoId prepends TODO- prefix", () => {
	assert.equal(formatTodoId("deadbeef"), "TODO-deadbeef");
});

test("normalizeTodoId strips TODO- prefix (case-insensitive)", () => {
	assert.equal(normalizeTodoId("TODO-deadbeef"), "deadbeef");
	assert.equal(normalizeTodoId("todo-deadbeef"), "deadbeef");
});

test("normalizeTodoId strips leading # character", () => {
	assert.equal(normalizeTodoId("#deadbeef"), "deadbeef");
});

test("normalizeTodoId returns id unchanged when already normalized", () => {
	assert.equal(normalizeTodoId("deadbeef"), "deadbeef");
});

test("validateTodoId accepts valid 8-char hex id", () => {
	const result = validateTodoId("deadbeef");
	assert.ok("id" in result);
	assert.equal(result.id, "deadbeef");
});

test("validateTodoId accepts TODO-prefixed id", () => {
	const result = validateTodoId("TODO-deadbeef");
	assert.ok("id" in result);
	assert.equal(result.id, "deadbeef");
});

test("validateTodoId normalizes id to lowercase", () => {
	const result = validateTodoId("DEADBEEF");
	assert.ok("id" in result);
	assert.equal(result.id, "deadbeef");
});

test("validateTodoId rejects empty string", () => {
	const result = validateTodoId("");
	assert.ok("error" in result);
});

test("validateTodoId rejects non-hex id", () => {
	const result = validateTodoId("nothexxx");
	assert.ok("error" in result);
});

test("validateTodoId rejects id with wrong length", () => {
	const result = validateTodoId("dead");
	assert.ok("error" in result);
});

test("displayTodoId formats with TODO- prefix", () => {
	assert.equal(displayTodoId("TODO-deadbeef"), "TODO-deadbeef");
	assert.equal(displayTodoId("deadbeef"), "TODO-deadbeef");
});

// ─── Status helpers ───────────────────────────────────────────────────────────

test("isTodoClosed returns true for closed status", () => {
	assert.equal(isTodoClosed("closed"), true);
});

test("isTodoClosed returns true for done status", () => {
	assert.equal(isTodoClosed("done"), true);
});

test("isTodoClosed is case-insensitive", () => {
	assert.equal(isTodoClosed("CLOSED"), true);
	assert.equal(isTodoClosed("Done"), true);
});

test("isTodoClosed returns false for open status", () => {
	assert.equal(isTodoClosed("open"), false);
	assert.equal(isTodoClosed("in-progress"), false);
});

// ─── Sorting ──────────────────────────────────────────────────────────────────

const makeTodo = (id, status = "open", created_at = "2024-01-01T00:00:00Z", assigned_to_session = undefined) => ({
	id,
	title: `Todo ${id}`,
	tags: [],
	status,
	created_at,
	assigned_to_session,
});

test("sortTodos puts open todos before closed ones", () => {
	const todos = [makeTodo("b", "closed"), makeTodo("a", "open")];
	const sorted = sortTodos(todos);
	assert.equal(sorted[0].id, "a");
	assert.equal(sorted[1].id, "b");
});

test("sortTodos puts assigned todos before unassigned open ones", () => {
	const todos = [
		makeTodo("unassigned", "open"),
		makeTodo("assigned", "open", "2024-01-01", "session.json"),
	];
	const sorted = sortTodos(todos);
	assert.equal(sorted[0].id, "assigned");
});

// ─── Filtering ────────────────────────────────────────────────────────────────

test("filterTodos returns all todos for empty query", () => {
	const todos = [makeTodo("a"), makeTodo("b")];
	assert.equal(filterTodos(todos, "").length, 2);
});

test("filterTodos matches by title", () => {
	const todos = [
		{ ...makeTodo("a"), title: "Fix the login bug" },
		{ ...makeTodo("b"), title: "Write tests" },
	];
	const result = filterTodos(todos, "login");
	assert.equal(result.length, 1);
	assert.equal(result[0].id, "a");
});

// ─── splitTodosByAssignment ────────────────────────────────────────────────────

test("splitTodosByAssignment categorizes todos correctly", () => {
	const todos = [
		makeTodo("closed", "closed"),
		makeTodo("assigned", "open", "2024-01-01", "sess.json"),
		makeTodo("open"),
	];
	const { assignedTodos, openTodos, closedTodos } = splitTodosByAssignment(todos);
	assert.equal(closedTodos.length, 1);
	assert.equal(assignedTodos.length, 1);
	assert.equal(openTodos.length, 1);
});

// ─── formatTodoHeading ────────────────────────────────────────────────────────

test("formatTodoHeading includes id and title", () => {
	const todo = { ...makeTodo("deadbeef"), title: "My task", tags: [] };
	const heading = formatTodoHeading(todo);
	assert.ok(heading.includes("TODO-deadbeef"));
	assert.ok(heading.includes("My task"));
});

test("formatTodoHeading includes tags when present", () => {
	const todo = { ...makeTodo("deadbeef"), tags: ["qa", "ci"] };
	const heading = formatTodoHeading(todo);
	assert.ok(heading.includes("[qa, ci]"));
});

// ─── formatTodoList ───────────────────────────────────────────────────────────

test("formatTodoList returns 'No todos.' for empty list", () => {
	assert.equal(formatTodoList([]), "No todos.");
});

test("formatTodoList shows section headers", () => {
	const list = formatTodoList([makeTodo("a", "open")]);
	assert.ok(list.includes("Assigned todos"));
	assert.ok(list.includes("Open todos"));
	assert.ok(list.includes("Closed todos"));
});

// ─── serializeTodoForAgent ────────────────────────────────────────────────────

test("serializeTodoForAgent formats id with TODO- prefix in JSON", () => {
	const todo = { ...makeTodo("deadbeef"), body: "" };
	const json = JSON.parse(serializeTodoForAgent(todo));
	assert.equal(json.id, "TODO-deadbeef");
});

// ─── serializeTodoListForAgent ────────────────────────────────────────────────

test("serializeTodoListForAgent groups todos by assignment", () => {
	const todos = [
		makeTodo("c", "closed"),
		makeTodo("a", "open", "2024-01-01", "session.json"),
		makeTodo("o"),
	];
	const json = JSON.parse(serializeTodoListForAgent(todos));
	assert.ok("assigned" in json);
	assert.ok("open" in json);
	assert.ok("closed" in json);
	assert.equal(json.assigned.length, 1);
	assert.equal(json.open.length, 1);
	assert.equal(json.closed.length, 1);
});

// ─── buildRefinePrompt ────────────────────────────────────────────────────────

test("buildRefinePrompt includes todo id and title", () => {
	const prompt = buildRefinePrompt("deadbeef", "My task");
	assert.ok(prompt.includes("TODO-deadbeef"));
	assert.ok(prompt.includes("My task"));
});

// ─── getTodoPath / getLockPath ────────────────────────────────────────────────

test("getTodoPath builds correct file path", () => {
	assert.ok(getTodoPath("/todos", "deadbeef").endsWith("deadbeef.md"));
});

test("getLockPath builds correct lock path", () => {
	assert.ok(getLockPath("/todos", "deadbeef").endsWith("deadbeef.lock"));
});

// ─── parseFrontMatter ─────────────────────────────────────────────────────────

test("parseFrontMatter parses valid JSON front matter", () => {
	const json = JSON.stringify({
		id: "deadbeef",
		title: "My task",
		tags: ["qa"],
		status: "open",
		created_at: "2024-01-01T00:00:00Z",
	});
	const result = parseFrontMatter(json, "fallback");
	assert.equal(result.id, "deadbeef");
	assert.equal(result.title, "My task");
	assert.deepEqual(result.tags, ["qa"]);
});

test("parseFrontMatter returns defaults for empty input", () => {
	const result = parseFrontMatter("", "fallback");
	assert.equal(result.id, "fallback");
	assert.equal(result.status, "open");
});

test("parseFrontMatter returns defaults for invalid JSON", () => {
	const result = parseFrontMatter("{not valid json}", "fallback");
	assert.equal(result.id, "fallback");
});

// ─── splitFrontMatter ─────────────────────────────────────────────────────────

test("splitFrontMatter extracts front matter and body", () => {
	const content = '{"id":"a","title":"t","tags":[],"status":"open","created_at":""}\n\nSome body text.';
	const { frontMatter, body } = splitFrontMatter(content);
	assert.ok(frontMatter.startsWith("{"));
	assert.equal(body.trim(), "Some body text.");
});

test("splitFrontMatter returns empty frontMatter for non-JSON content", () => {
	const { frontMatter, body } = splitFrontMatter("just plain text");
	assert.equal(frontMatter, "");
	assert.equal(body, "just plain text");
});

// ─── serializeTodo / parseTodoContent round-trip ──────────────────────────────

test("serializeTodo / parseTodoContent round-trip", () => {
	const todo = {
		id: "deadbeef",
		title: "Test",
		tags: ["a"],
		status: "open",
		created_at: "2024-01-01T00:00:00Z",
		body: "Some body.\n",
	};
	const serialized = serializeTodo(todo);
	const parsed = parseTodoContent(serialized, "deadbeef");
	assert.equal(parsed.title, todo.title);
	assert.deepEqual(parsed.tags, todo.tags);
	assert.equal(parsed.body.trim(), todo.body.trim());
});

// ─── normalizeTodoSettings ────────────────────────────────────────────────────

test("normalizeTodoSettings applies defaults for empty object", () => {
	const settings = normalizeTodoSettings({});
	assert.equal(settings.gc, true);
	assert.equal(settings.gcDays, 7);
});

test("normalizeTodoSettings clamps gcDays to non-negative integer", () => {
	const settings = normalizeTodoSettings({ gcDays: -5 });
	assert.equal(settings.gcDays, 0);
});

test("normalizeTodoSettings floors fractional gcDays", () => {
	const settings = normalizeTodoSettings({ gcDays: 3.9 });
	assert.equal(settings.gcDays, 3);
});
