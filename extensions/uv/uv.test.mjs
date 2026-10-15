import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getBlockedCommandMessage } from "./helpers.ts";
import uvExtension from "./index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mypacRoot = resolve(__dirname, "../..");
const interceptedCommandsPath = resolve(__dirname, "intercepted-commands");

function pathWithoutCommands(...commandNames) {
	const commandPaths = commandNames.flatMap((command) => spawnSync("bash", ["-lc", 'type -aP "$1" 2>/dev/null || true', "_", command], {
		encoding: "utf8",
	}).stdout.trim().split("\n").filter(Boolean));
	const commandDirs = new Set(commandPaths.map((path) => dirname(path)));

	return (process.env.PATH ?? "")
		.split(":")
		.filter((path) => path && path !== interceptedCommandsPath && !commandDirs.has(path))
		.join(":");
}

function pathWithoutUv() {
	return pathWithoutCommands("uv");
}

function pathWithoutUvOrMise() {
	return pathWithoutCommands("uv", "mise");
}

// --- Allowed commands ---

test("allows plain uv commands", async () => {
	assert.equal(await getBlockedCommandMessage("uv run script.py"), null);
	assert.equal(await getBlockedCommandMessage("uv add requests"), null);
	assert.equal(await getBlockedCommandMessage("uv sync"), null);
});

test("allows python without blocked subcommands", async () => {
	assert.equal(await getBlockedCommandMessage("python script.py"), null);
	assert.equal(await getBlockedCommandMessage("python3 --version"), null);
	assert.equal(await getBlockedCommandMessage(".venv/bin/python script.py"), null);
});

test("allows Python examples in heredoc data and quoted arguments", async () => {
	for (const command of [
		"cat <<'EOF'\npip install requests\npython -m venv .venv\nEOF",
		"cat <<EOF\npip install requests\npython -m py_compile example.py\nEOF",
		"printf '%s\\n' 'example:\npip install requests\npython -m pip install requests'",
		'echo "example; pip install requests | python -m venv .venv"',
		'python -c "print(\'-m pip\')"',
	]) {
		assert.equal(await getBlockedCommandMessage(command), null, command);
	}
});
test("Bash interception executes shell data without treating it as commands", async () => {
	let bash;
	uvExtension({ registerTool(tool) { bash = tool; } });
	for (const command of [
		"cat <<'EOF'\npip install requests\npython -m venv .venv\nEOF",
		"cat <<EOF\npip install requests\npython -m py_compile example.py\nEOF",
		"cat <<-EOF\n\tpip install requests\n\tEOF",
		"printf '%s\\n' 'examples:\npip install requests\npython -m pip install requests'",
		'echo "example; pip install requests | python -m venv .venv"',
		"# pip install requests\nprintf '%s' 'ordinary text'",
	]) {
		const result = await bash.execute("data", { command }).catch((error) => {
			throw new Error(`${JSON.stringify(command)}: ${error.message}`);
		});
		assert.equal(result.isError, undefined, JSON.stringify(result));
		assert.match(result.content[0].text, /pip|ordinary text/);
	}
});

test("valid Bash with multiple heredocs executes literal data through the wrapped tool", async () => {
	let bash;
	uvExtension({ registerTool(tool) { bash = tool; } });
	for (const command of [
		"cat <<'ONE' <<'TWO'\npip install foo\nONE\npython -m pip\nTWO",
		"cat <<ONE <<TWO\npython -m venv .venv\nONE\npython -m pip\nTWO",
		"cat <<-'ONE' <<-'TWO'\n\tpip install foo\n\tONE\n\tpython -m pip\n\tTWO",
	]) {
		const syntax = spawnSync("bash", ["-n"], { input: command, encoding: "utf8" });
		assert.equal(syntax.status, 0, syntax.stderr);
		const result = await bash.execute("multiple-heredocs", { command });
		assert.equal(result.isError, undefined, JSON.stringify(result));
		assert.equal(result.content[0].text, "python -m pip\n");
	}
});

test("Bash interception rejects real command nodes and explicit paths with guidance", async () => {
	let bash;
	uvExtension({ registerTool(tool) { bash = tool; } });
	for (const [command, guidance] of [
		["pip install requests", "pip is disabled"],
		["echo start\npip3 install requests", "pip3 is disabled"],
		["true &&\n.venv/bin/pip install requests", "pip is disabled"],
		["false || .venv/bin/poetry add requests", "poetry is disabled"],
		["printf '' |\n.venv/bin/python3.14 -m pip", "python -m pip' is disabled"],
		[".venv/bin/python -m \\\nvenv .venv", "uv venv"],
		['"/tmp/with spaces/python3.14" -I -m "py_compile" example.py', "uv run python -m ast"],
		["p\\ip install requests", "pip is disabled"],
		["'pi'p install requests", "pip is disabled"],
		["cat <<EOF\n$(pip install requests)\nEOF", "pip is disabled"],
		["cat <<'EOF'\npip install data\nEOF\n.venv/bin/python -mpip", "python -m pip' is disabled"],
		["cat <<'ONE' <<'TWO'\npip install data\nONE\npython -m pip\nTWO\n.venv/bin/python -m pip", "python -m pip' is disabled"],
		["cat <<'ONE' <<'TWO' | .venv/bin/pip install requests\npython -m pip\nONE\npip install data\nTWO", "pip is disabled"],
		["cat <<ONE <<TWO\npip install data\nONE\n$(.venv/bin/python -m venv .venv)\nTWO", "uv venv"],
	]) {
		await assert.rejects(bash.execute("blocked", { command }), (error) => {
			assert.ok(error.message.includes(guidance), `${command}: ${error.message}`);
			return true;
		});
	}
});

test("only Python interpreter module options are rejected, not script arguments", async () => {
	for (const command of [
		'python -c "pip"',
		'python -c "print(1)" -m pip',
		"python -c'print(1)' -m pip",
		'python script.py -m venv',
		'python -m ast pip',
		'python -W pip script.py',
		'python -- -m pip',
		"cat <<'EOF'\n$(pip install data)\nEOF",
	]) {
		assert.equal(await getBlockedCommandMessage(command), null, command);
	}
	assert.ok((await getBlockedCommandMessage('python -W ignore -m pip')).includes("is disabled"));
	await assert.rejects(getBlockedCommandMessage("echo 'unterminated"));
});
// --- pip ---

test("blocks bare pip", async () => {
	const msg = await getBlockedCommandMessage("pip install requests");
	assert.ok(msg?.includes("pip is disabled"));
});

test("blocks pip3", async () => {
	const msg = await getBlockedCommandMessage("pip3 install requests");
	assert.ok(msg?.includes("pip3 is disabled"));
});

test("blocks pip after semicolon", async () => {
	const msg = await getBlockedCommandMessage("echo hi; pip install requests");
	assert.ok(msg?.includes("pip is disabled"));
});

test("blocks pip with explicit path", async () => {
	const msg = await getBlockedCommandMessage(".venv/bin/pip install requests");
	assert.ok(msg?.includes("pip is disabled"));
});

// --- poetry ---

test("blocks poetry", async () => {
	const msg = await getBlockedCommandMessage("poetry add requests");
	assert.ok(msg?.includes("poetry is disabled"));
	assert.ok(msg?.includes("uv add"));
});

// --- python -m pip ---

test("blocks python -m pip", async () => {
	const msg = await getBlockedCommandMessage("python -m pip install requests");
	assert.ok(msg?.includes("python -m pip' is disabled"));
});

test("blocks python3 -m pip", async () => {
	const msg = await getBlockedCommandMessage("python3 -m pip install requests");
	assert.ok(msg?.includes("python -m pip' is disabled"));
});

test("blocks .venv/bin/python -m pip", async () => {
	const msg = await getBlockedCommandMessage(".venv/bin/python -m pip install requests");
	assert.ok(msg?.includes("python -m pip' is disabled"));
});

// --- python -m venv ---

test("blocks python -m venv", async () => {
	const msg = await getBlockedCommandMessage("python -m venv .venv");
	assert.ok(msg?.includes("python -m venv' is disabled"));
	assert.ok(msg?.includes("uv venv"));
});

// --- python -m py_compile ---

test("blocks python -m py_compile", async () => {
	const msg = await getBlockedCommandMessage("python -m py_compile script.py");
	assert.ok(msg?.includes("py_compile' is disabled"));
	assert.ok(msg?.includes("uv run python -m ast"));
});

// --- multiline commands ---

test("blocks pip in multiline command", async () => {
	const msg = await getBlockedCommandMessage("echo start\npip install foo\necho done");
	assert.ok(msg?.includes("pip is disabled"));
});

test("python shim handles uv path containing spaces", () => {
	const tmp = mkdtempSync(join(tmpdir(), "uv path "));
	try {
		const managedPython = join(tmp, "managed-python");
		const fakeUv = join(tmp, "uv");
		writeFileSync(managedPython, "#!/usr/bin/env bash\nexit 0\n");
		chmodSync(managedPython, 0o755);
		writeFileSync(fakeUv, `#!/usr/bin/env bash
set -eu
if [ "$1" = "python" ] && [ "$2" = "find" ]; then
	printf '%s\n' "$FAKE_MANAGED_PYTHON"
	exit 0
fi
if [ "$1" = "run" ]; then
	printf 'UV_PYTHON=%s\n' "$3"
	exit 0
fi
exit 99
`);
		chmodSync(fakeUv, 0o755);

		const result = spawnSync(resolve(interceptedCommandsPath, "python3"), ["--version"], {
			env: {
				...process.env,
				FAKE_MANAGED_PYTHON: managedPython,
				PATH: `${tmp}:${interceptedCommandsPath}:${pathWithoutUv()}`,
			},
			encoding: "utf8",
		});

		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.equal(result.stdout.trim(), `UV_PYTHON=${managedPython}`);
	} finally {
		rmSync(tmp, { force: true, recursive: true });
	}
});

test("python shim ignores shell functions named uv", () => {
	const tmp = mkdtempSync(join(tmpdir(), "uv function "));
	try {
		const managedPython = join(tmp, "managed-python");
		const fakeUv = join(tmp, "uv");
		writeFileSync(managedPython, "#!/usr/bin/env bash\nexit 0\n");
		chmodSync(managedPython, 0o755);
		writeFileSync(fakeUv, `#!/usr/bin/env bash
set -eu
if [ "$1" = "python" ] && [ "$2" = "find" ]; then
	printf '%s\n' "$FAKE_MANAGED_PYTHON"
	exit 0
fi
if [ "$1" = "run" ]; then
	printf 'UV_PYTHON=%s\n' "$3"
	exit 0
fi
exit 99
`);
		chmodSync(fakeUv, 0o755);

		const result = spawnSync(resolve(interceptedCommandsPath, "python3"), ["--version"], {
			env: {
				...process.env,
				"BASH_FUNC_uv%%": "() { return 99; }",
				FAKE_MANAGED_PYTHON: managedPython,
				PATH: `${tmp}:${interceptedCommandsPath}:${pathWithoutUv()}`,
			},
			encoding: "utf8",
		});

		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.equal(result.stdout.trim(), `UV_PYTHON=${managedPython}`);
	} finally {
		rmSync(tmp, { force: true, recursive: true });
	}
});

test("python shim ignores shell functions named mise", () => {
	const tmp = mkdtempSync(join(tmpdir(), "mise function "));
	try {
		const managedPython = join(tmp, "managed-python");
		const fakeUv = join(tmp, "managed uv");
		const fakeMise = join(tmp, "mise");
		writeFileSync(managedPython, "#!/usr/bin/env bash\nexit 0\n");
		chmodSync(managedPython, 0o755);
		writeFileSync(fakeUv, `#!/usr/bin/env bash
set -eu
if [ "$1" = "python" ] && [ "$2" = "find" ]; then
	printf '%s\n' "$FAKE_MANAGED_PYTHON"
	exit 0
fi
if [ "$1" = "run" ]; then
	printf 'UV_PYTHON=%s\n' "$3"
	exit 0
fi
exit 99
`);
		chmodSync(fakeUv, 0o755);
		writeFileSync(fakeMise, `#!/usr/bin/env bash
set -eu
if [ "$1" = "which" ] && [ "$4" = "uv" ]; then
	printf '%s\n' "$FAKE_UV"
	exit 0
fi
exit 99
`);
		chmodSync(fakeMise, 0o755);

		const result = spawnSync(resolve(interceptedCommandsPath, "python3"), ["--version"], {
			env: {
				...process.env,
				"BASH_FUNC_mise%%": "() { return 99; }",
				FAKE_MANAGED_PYTHON: managedPython,
				FAKE_UV: fakeUv,
				PATH: `${tmp}:${interceptedCommandsPath}:${pathWithoutUv()}`,
			},
			encoding: "utf8",
		});

		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.equal(result.stdout.trim(), `UV_PYTHON=${managedPython}`);
	} finally {
		rmSync(tmp, { force: true, recursive: true });
	}
});

test("Python shims distinguish module invocations from script data", () => {
	const tmp = mkdtempSync(join(tmpdir(), "uv arguments "));
	try {
		const uv = join(tmp, "uv");
		writeFileSync(uv, '#!/bin/bash\nif [ "$1" = python ]; then echo /bin/true; else printf "ARG=%s\\n" "$@"; fi\n');
		chmodSync(uv, 0o755);
		for (const name of ["python", "python3"]) {
			const run = (args) => spawnSync(join(interceptedCommandsPath, name), args, {
				env: { ...process.env, PATH: `${tmp}:${process.env.PATH}` }, encoding: "utf8",
			});
			for (const args of [["-c", "pip"], ["-cprint(1)", "-m", "pip"], ["script.py", "-m", "venv"], ["-m", "ast", "pip"], ["-W", "pip", "script.py"]]) {
				const result = run(args);
				assert.equal(result.status, 0, `${name} ${args}: ${result.stderr}`);
				assert.ok(result.stdout.includes(`ARG=${args.at(-1)}`), result.stdout);
			}
			for (const args of [["-m", "pip"], ["-I", "-mvenv"], ["-m", "py_compile"], ["-W", "ignore", "-m", "pip"]]) {
				const result = run(args);
				assert.equal(result.status, 1, `${name} ${args}: ${result.stderr}`);
				assert.match(result.stderr, /is disabled/);
			}
		}
	} finally {
		rmSync(tmp, { force: true, recursive: true });
	}
});
// --- unavailable uv runtime ---

test("python shim uses mypac mise uv when uv unavailable on PATH", (t) => {
	const simulatedPath = pathWithoutUv();
	const misePath = spawnSync("bash", ["-lc", "type -P mise || true"], {
		env: { ...process.env, PATH: simulatedPath },
		encoding: "utf8",
	}).stdout.trim();
	const systemPython = spawnSync("bash", ["-lc", "command -v python3 || command -v python || true"], {
		env: { ...process.env, PATH: simulatedPath },
		encoding: "utf8",
	}).stdout.trim();

	if (!misePath) {
		t.skip("mise is unavailable on PATH");
		return;
	}
	if (!systemPython) {
		t.skip("no system Python available outside shim path");
		return;
	}

	const miseUvPath = spawnSync(misePath, ["which", "-C", mypacRoot, "uv"], {
		env: { ...process.env, PATH: simulatedPath },
		encoding: "utf8",
	}).stdout.trim();
	const miseUvExecutable = spawnSync("bash", ["-lc", "[ -x \"$1\" ]", "_", miseUvPath]);
	if (!miseUvPath || miseUvExecutable.status !== 0) {
		t.skip("mise cannot resolve an executable uv for this repo");
		return;
	}

	const result = spawnSync(resolve(interceptedCommandsPath, "python3"), ["--version"], {
		cwd: "/tmp",
		env: { ...process.env, PATH: `${interceptedCommandsPath}:${simulatedPath}` },
		encoding: "utf8",
	});

	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.match(`${result.stdout}\n${result.stderr}`, /Python \d+\.\d+/);
	assert.ok(!result.stderr.includes("uv is required"), result.stderr);
});

test("python shim explains how to install uv when uv is unavailable", () => {
	const simulatedPath = pathWithoutUvOrMise();
	const systemPython = spawnSync("bash", ["-lc", "command -v python3 || command -v python || true"], {
		env: { ...process.env, PATH: simulatedPath },
		encoding: "utf8",
	}).stdout.trim();

	if (!systemPython) {
		return;
	}

	const result = spawnSync(resolve(interceptedCommandsPath, "python3"), ["--version"], {
		env: { ...process.env, PATH: `${interceptedCommandsPath}:${simulatedPath}` },
		encoding: "utf8",
	});

	assert.notEqual(result.status, 0);
	assert.ok(result.stderr.includes("uv is required"), result.stderr);
	assert.ok(result.stderr.includes("mise install uv or brew install uv"), result.stderr);
	assert.ok(result.stderr.includes("run 'pi config' and disable only the uv extension"), result.stderr);
	assert.ok(result.stderr.includes("disable all extensions for one run"), result.stderr);
	assert.ok(result.stderr.includes("--no-extensions"), result.stderr);
});
