/** Syntax-aware command guidance, backed by the packaged Bash WASM grammar. */
import { fileURLToPath } from "node:url";
import { Language, Parser, type Node } from "web-tree-sitter";

const parserReady = Parser.init().then(async () => {
	const parser = new Parser();
	parser.setLanguage(await Language.load(fileURLToPath(
		import.meta.resolve("tree-sitter-bash/tree-sitter-bash.wasm"),
	)));
	return parser;
});

// Decode only static words from the grammar; never evaluate shell expansions.
function literal(node: Node | null): string | null {
	if (!node) return null;
	switch (node.type) {
		case "word":
			return node.text.replace(/\\\n/g, "").replace(/\\(.)/gs, "$1");
		case "raw_string":
			return node.text.slice(1, -1);
		case "string":
			if (node.namedChildren.some((child) => child?.type !== "string_content")) return null;
			return node.text.slice(1, -1).replace(/\\([$`"\\\n])/g, (_, char: string) => char === "\n" ? "" : char);
		case "command_name":
		case "concatenation": {
			const parts = node.namedChildren.map(literal);
			return parts.includes(null) ? null : parts.join("");
		}
		default:
			return null;
	}
}

function blockedInvocation(node: Node): string | null {
	const name = node.childForFieldName("name");
	const executable = name && literal(name)?.split("/").pop();
	if (!executable) return null;
	if (["pip", "pip3", "poetry"].includes(executable)) return executable;
	if (!/^python(?:3(?:\.\d+)?)?$/.test(executable)) return null;

	const args = node.childrenForFieldName("argument").map(literal);
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
	const parser = await parserReady;
	const tree = parser.parse(command);
	if (!tree) throw new Error("Unable to inspect Bash syntax for uv command guidance.");
	try {
		if (tree.rootNode.hasError) {
			throw new Error("Unable to inspect Bash syntax for uv command guidance. Use supported Bash syntax or disable the uv extension.");
		}
		for (const node of tree.rootNode.descendantsOfType("command")) {
			const message = node && messageFor(blockedInvocation(node));
			if (message) return message;
		}
		return null;
	} finally {
		tree.delete();
	}
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
