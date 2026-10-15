/** Syntax-aware command guidance, backed by mvdan/sh's Bash parser via WASM. */
import { parseSync, walk, type ShNodes } from "sh-ast";

// Decode only static AST words; never evaluate shell expansions.
function literal(node: ShNodes.ShWordNode | ShNodes.ShWordPartNode, quoted = false): string | null {
	switch (node.type) {
		case "Lit":
			return quoted
				? (node.value ?? "").replace(/\\([$`"\\\n])/g, (_, char: string) => char === "\n" ? "" : char)
				: (node.value ?? "").replace(/\\\n/g, "").replace(/\\(.)/gs, "$1");
		case "SglQuoted":
			return node.dollar ? null : (node.value ?? "");
		case "DblQuoted":
		case "Word": {
			if (node.type === "DblQuoted" && node.dollar) return null;
			const parts = node.parts.map((part) => literal(part, node.type === "DblQuoted" || quoted));
			return parts.includes(null) ? null : parts.join("");
		}
		default:
			return null;
	}
}

function blockedInvocation(node: ShNodes.ShCallExprNode): string | null {
	const executable = node.args[0] && literal(node.args[0])?.split("/").pop();
	if (!executable) return null;
	if (["pip", "pip3", "poetry"].includes(executable)) return executable;
	if (!/^python(?:3(?:\.\d+)?)?$/.test(executable)) return null;

	const args = node.args.slice(1).map((arg) => literal(arg));
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === null || arg.startsWith("-c") || arg === "--" || arg === "-" || !arg.startsWith("-")) break;
		if (arg.startsWith("-m")) {
			const module = arg === "-m" ? args[i + 1] : arg.slice(2);
			if (module === "pip") return "pip-module";
			return module && ["venv", "py_compile"].includes(module) ? module : null;
		}
		if (["-W", "-X", "--check-hash-based-pycs"].includes(arg)) i++;
	}
	return null;
}

export async function getBlockedCommandMessage(command: string): Promise<string | null> {
	const file = parseSync(command, { dialect: "bash" });
	let message: string | null = null;
	walk(file, (node) => {
		if (!message && node.type === "CallExpr") {
			message = messageFor(blockedInvocation(node as ShNodes.ShCallExprNode));
		}
	});
	return message;
}

function messageFor(invocation: string | null): string | null {
	if (invocation === "pip" || invocation === "pip3" || invocation === "pip-module") {
		const name = invocation === "pip-module" ? "'python -m pip'" : invocation;
		return [
			`Error: ${name} is disabled. Use uv instead:`,
			"",
			"  To install a package for a script: uv run --with PACKAGE python script.py",
			"  To add a dependency to the project: uv add PACKAGE",
			"",
		].join("\n");
	}
	if (invocation === "poetry") {
		return [
			"Error: poetry is disabled. Use uv instead:",
			"",
			"  To initialize a project: uv init",
			"  To add a dependency: uv add PACKAGE",
			"  To sync dependencies: uv sync",
			"  To run commands: uv run COMMAND",
			"",
		].join("\n");
	}
	if (invocation === "venv") {
		return [
			"Error: 'python -m venv' is disabled. Use uv instead:",
			"",
			"  To create a virtual environment: uv venv",
			"",
		].join("\n");
	}
	if (invocation === "py_compile") {
		return [
			"Error: 'python -m py_compile' is disabled because it writes .pyc files to __pycache__.",
			"",
			"  To verify syntax without bytecode output: uv run python -m ast path/to/file.py >/dev/null",
			"",
		].join("\n");
	}
	return null;
}
