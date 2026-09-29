import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	chmodSync,
	cpSync,
	existsSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const installSource = join(scriptsDir, "install.sh");
const bootstrapSource = join(scriptsDir, "..", ".mise", "tasks", "bootstrap.sh");
const configSource = join(scriptsDir, "..", ".mise", "config.toml");
const syncSource = join(scriptsDir, "..", ".mise", "tasks", "sync.sh");
const hooksSource = join(scriptsDir, "..", ".mise", "tasks", "hooks.sh");
const hkConfigSource = join(scriptsDir, "..", ".config", "hk.pkl");
const messageCheckSource = join(scriptsDir, "check-commit-message.sh");
const environmentSource = join(scriptsDir, "..", ".mise", "global-environment");
const computerUseOptInSource = join(scriptsDir, "configure-computer-use-opt-in.mjs");

function createFixture(t) {
	const root = mkdtempSync(join(tmpdir(), "mypac-bootstrap-"));
	const bin = join(root, "bin");
	mkdirSync(join(root, "scripts"));
	mkdirSync(bin);
	cpSync(installSource, join(root, "scripts", "install.sh"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	return { root, bin, log: join(root, "commands.log") };
}

function writeCommand(bin, name, body) {
	const path = join(bin, name);
	writeFileSync(path, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
	chmodSync(path, 0o755);
}

function runInstall(fixture) {
	return spawnSync("/bin/bash", [join(fixture.root, "scripts", "install.sh")], {
		cwd: fixture.root,
		env: { ...process.env, PATH: `${fixture.bin}:/usr/bin:/bin` },
		encoding: "utf8",
	});
}

test("install delegates setup to mise run bootstrap", (t) => {
	const fixture = createFixture(t);
	writeCommand(fixture.bin, "mise", `printf '%s\\n' "$*" >> ${JSON.stringify(fixture.log)}`);

	const result = runInstall(fixture);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(readFileSync(fixture.log, "utf8"), "run bootstrap\n");
});

test("install fails with actionable guidance when mise is missing", (t) => {
	const fixture = createFixture(t);

	const result = runInstall(fixture);

	assert.equal(result.status, 1);
	assert.match(result.stderr, /mise is required/);
	assert.match(result.stderr, /https:\/\/mise\.jdx\.dev/);
});

function createBootstrapFixture(t) {
	const fixture = createFixture(t);
	mkdirSync(join(fixture.root, ".mise", "tasks"), { recursive: true });
	cpSync(bootstrapSource, join(fixture.root, ".mise", "tasks", "bootstrap.sh"));
	return fixture;
}

function runBootstrap(fixture, env = {}) {
	return spawnSync("/bin/bash", [join(fixture.root, ".mise", "tasks", "bootstrap.sh")], {
		cwd: fixture.root,
		env: { ...process.env, MISE_SHELL: "bash", PATH: `${fixture.bin}:/usr/bin:/bin`, ...env },
		encoding: "utf8",
	});
}

test("bootstrap accepts mise-reported custom shims and reports a non-fatal Pi pin mismatch", (t) => {
	const fixture = createBootstrapFixture(t);
	writeFileSync(
		join(fixture.root, ".mise", "tasks", "sync.sh"),
		`#!/usr/bin/env bash\nprintf 'sync\\t%s\\n' "$1" >> ${JSON.stringify(fixture.log)}\n`,
	);
	chmodSync(join(fixture.root, ".mise", "tasks", "sync.sh"), 0o755);
	writeFileSync(
		join(fixture.root, "package.json"),
		'{"devDependencies":{"@earendil-works/pi-coding-agent":"0.84.3"}}\n',
	);
	writeCommand(
		fixture.bin,
		"npm",
		`printf 'npm\\t%s\\n' "$*" >> ${JSON.stringify(fixture.log)}`,
	);
	writeCommand(
		fixture.bin,
		"mise",
		`printf 'mise\\t%s\\n' "$*" >> ${JSON.stringify(fixture.log)}\n[[ "$*" != "doctor --json" ]] || printf '%s\\n' '{"activated":false,"shims_on_path":true}'`,
	);
	writeCommand(
		fixture.bin,
		"pi",
		`printf 'pi\\t%s\\n' "$*" >> ${JSON.stringify(fixture.log)}\n[[ "\${1:-}" == "--version" ]] && echo '0.85.0'`,
	);

	const result = runBootstrap(fixture, {
		MISE_DATA_DIR: join(fixture.root, "custom-mise-data"),
		MISE_SHELL: "",
	});

	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(readFileSync(fixture.log, "utf8").trim().split("\n"), [
		"mise\tdoctor --json",
		"sync\tvalidate",
		"sync\tfoundation",
		"mise\tenv -s bash",
		"pi\t--version",
		"mise\trun deps",
		"mise\tinstall",
		"sync\tapplication",
		"sync\tpi",
		"sync\tsetup",
		"sync\tverify",
	]);
	assert.match(result.stdout, /Installed Pi: 0\.85\.0/);
	assert.match(result.stdout, /mypac tested Pi: 0\.84\.3/);
});

test("bootstrap fails with actionable guidance when Pi is missing", (t) => {
	const fixture = createBootstrapFixture(t);
	writeFileSync(join(fixture.root, ".mise", "tasks", "sync.sh"), "#!/usr/bin/env bash\nexit 0\n");
	chmodSync(join(fixture.root, ".mise", "tasks", "sync.sh"), 0o755);
	writeCommand(fixture.bin, "npm", "exit 0");
	writeCommand(fixture.bin, "mise", '[[ "$*" != "doctor --json" ]] || echo \'{"activated":true,"shims_on_path":false}\'');

	const result = runBootstrap(fixture);

	assert.equal(result.status, 1);
	assert.match(result.stderr, /Pi is required/);
});

test("bootstrap rejects missing persistent mise integration before mutation", (t) => {
	const fixture = createBootstrapFixture(t);
	writeCommand(
		fixture.bin,
		"mise",
		`printf 'mise\\t%s\\n' "$*" >> ${JSON.stringify(fixture.log)}\n[[ "$*" == "doctor --json" ]] && printf '%s\\n' '{"activated":false,"shims_on_path":false}'`,
	);

	const result = runBootstrap(fixture, { MISE_SHELL: "bash" });

	assert.equal(result.status, 1);
	assert.match(result.stderr, /shell activation or shims/);
	assert.match(result.stderr, /mise\.jdx\.dev\/cli\/activate\.html/);
	assert.equal(readFileSync(fixture.log, "utf8"), "mise\tdoctor --json\n");
});

test("global environment owns each exact pin once with a closed phase", () => {
	const config = readFileSync(configSource, "utf8");
	const declarations = readFileSync(environmentSource, "utf8")
		.split("\n")
		.filter((line) => line && !line.startsWith("#"));
	const parsed = declarations.map((line) => line.split(/\s+/));

	assert.ok(parsed.every((entry) => entry.length === 3));
	assert.ok(parsed.every(([phase]) => ["foundation", "application", "pi"].includes(phase)));
	assert.ok(parsed.every(([, , specification]) => /@[0-9]+(?:\.[0-9]+)+$/.test(specification)));
	assert.equal(new Set(parsed.map(([, , specification]) => specification)).size, parsed.length);
	assert.deepEqual(
		parsed.filter(([phase]) => phase === "foundation").map(([, , specification]) => specification),
		["node@24.20.0", "uv@0.12.6"],
	);
	assert.deepEqual(
		parsed.filter(([phase]) => phase === "application").map(([, , specification]) => specification),
		[
			"gh@2.98.0",
			"aqua:max-sixty/worktrunk@0.75.0",
			"pipx:headroom-ai[extras=all]@0.39.1",
			"npm:agent-browser@0.34.0",
		],
	);
	assert.doesNotMatch(config, /^uv\s*=/m);
	assert.doesNotMatch(config, /depends\s*=\s*"uv"/);
});

function runPiRuntimeSmoke(agentDir, cwd) {
	const env = Object.fromEntries(
		Object.entries(process.env).filter(([key]) => !/(?:API_KEY|AUTH_TOKEN|OAUTH_TOKEN)$/.test(key)),
	);
	return spawnSync("pi", ["--offline", "--no-approve", "--no-session", "--print"], {
		cwd,
		env: { ...env, PI_CODING_AGENT_DIR: agentDir },
		input: "",
		encoding: "utf8",
	});
}

test("Pi runtime smoke accepts the registered current mypac package without auth", (t) => {
	const fixture = createFixture(t);
	const agentDir = join(fixture.root, "agent");
	const projectDir = join(fixture.root, "project");
	mkdirSync(agentDir);
	mkdirSync(projectDir);
	writeFileSync(
		join(agentDir, "settings.json"),
		JSON.stringify({ packages: [join(scriptsDir, "..")] }),
	);

	const result = runPiRuntimeSmoke(agentDir, projectDir);

	assert.equal(result.status, 0, result.stderr);
});

test("Pi runtime smoke fails for a broken registered extension", (t) => {
	const fixture = createFixture(t);
	const agentDir = join(fixture.root, "agent");
	const projectDir = join(fixture.root, "project");
	const packageDir = join(fixture.root, "broken-package");
	mkdirSync(agentDir);
	mkdirSync(projectDir);
	mkdirSync(packageDir);
	writeFileSync(
		join(packageDir, "package.json"),
		JSON.stringify({
			name: "broken-pi-runtime-smoke",
			version: "1.0.0",
			pi: { extensions: ["./broken.ts"] },
		}),
	);
	writeFileSync(join(packageDir, "broken.ts"), "throw new Error('deliberate runtime smoke failure');\n");
	writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ packages: [packageDir] }));

	const result = runPiRuntimeSmoke(agentDir, projectDir);

	assert.equal(result.status, 1);
	assert.match(result.stderr, /Failed to load extension/);
	assert.match(result.stderr, /deliberate runtime smoke failure/);
});

function loggingCommand(fixture, name, extra = "") {
	writeCommand(
		fixture.bin,
		name,
		`printf '${name}' >> ${JSON.stringify(fixture.log)}\nprintf '\\t%s' "$@" >> ${JSON.stringify(fixture.log)}\nprintf '\\n' >> ${JSON.stringify(fixture.log)}\n${extra}\ntrue`,
	);
}

function createSyncFixture(t, suffix = "") {
	const parent = realpathSync(mkdtempSync(join(tmpdir(), "mypac-sync-")));
	const root = join(parent, `checkout${suffix}`);
	const bin = join(parent, "bin");
	const home = join(parent, "home");
	mkdirSync(join(root, ".mise", "tasks"), { recursive: true });
	mkdirSync(join(root, "scripts"));
	mkdirSync(bin);
	mkdirSync(home);
	cpSync(syncSource, join(root, ".mise", "tasks", "sync.sh"));
	cpSync(environmentSource, join(root, ".mise", "global-environment"));
	cpSync(computerUseOptInSource, join(root, "scripts", "configure-computer-use-opt-in.mjs"));
	const fixture = { root, bin, home, log: join(parent, "commands.log") };
	t.after(() => rmSync(parent, { recursive: true, force: true }));
	return fixture;
}

function installSyncCommands(
	fixture,
	{
		uvVersion = "0.12.6",
		wtMisePath = join(fixture.bin, "wt"),
		npmMisePath = join(fixture.bin, "npm"),
	} = {},
) {
	loggingCommand(
		fixture,
		"mise",
		`if [[ "\${1:-}" == "which" ]]; then
			case "\${2:-}" in
				wt) printf '%s\\n' ${JSON.stringify(wtMisePath)} ;;
				npm) printf '%s\\n' ${JSON.stringify(npmMisePath)} ;;
				*) command -v "\${2:-}" ;;
			esac
		fi`,
	);
	loggingCommand(
		fixture,
		"node",
		`if [[ "\${1:-}" == "--version" ]]; then
		echo "v24.20.0"
	elif [[ "\${1:-}" == */pi-computer-use/scripts/setup-helper.mjs ]]; then
		true
	else
		exec ${JSON.stringify(process.execPath)} "$@"
	fi`,
	);
	loggingCommand(fixture, "uname", "echo Darwin");
	loggingCommand(
		fixture,
		"uv",
		`[[ "\${1:-}" == "--version" ]] && echo "uv ${uvVersion}"`,
	);
	loggingCommand(fixture, "gh", '[[ "${1:-}" == "--version" ]] && echo "gh version 2.98.0"');
	loggingCommand(
		fixture,
		"wt",
		'[[ "${1:-}" == "--version" ]] && echo "wt 0.75.0"\n[[ "$*" == "list --format=json" ]] && echo "[]"',
	);
	loggingCommand(fixture, "headroom", '[[ "${1:-}" == "--version" ]] && echo "headroom, version 0.39.1"');
	loggingCommand(fixture, "agent-browser", '[[ "${1:-}" == "--version" ]] && echo "agent-browser 0.34.0"');
	loggingCommand(
		fixture,
		"pi",
		`if [[ "\${1:-}" == "install" && "\${2:-}" == "npm:@injaneity/pi-computer-use@0.5.1" ]]; then
		mkdir -p "$HOME/.pi/agent"
		printf '%s\\n' '{"packages":["npm:@injaneity/pi-computer-use@0.5.1"]}' > "$HOME/.pi/agent/settings.json"
	fi
	if [[ "\${1:-}" == "list" ]]; then
		printf '%s\\n' 'npm:pi-agent-browser-native@0.5.0' 'npm:pi-codex-search@0.1.6' 'npm:@injaneity/pi-computer-use@0.5.1' ${JSON.stringify(fixture.root)}
	fi`,
	);
	loggingCommand(
		fixture,
		"npm",
		`[[ "\${1:-}" == "--version" ]] && echo "11.19.0"\n[[ "\${1:-}" != "exec" || "$PWD" != ${JSON.stringify(fixture.root)} ]] || { echo "doctor ran from the mypac checkout" >&2; exit 1; }`,
	);
}

function installRefreshDependentCommands(fixture) {
	const available = join(dirname(fixture.bin), "available");
	const toolsBin = join(dirname(fixture.bin), "mise-tools");
	mkdirSync(available);
	mkdirSync(toolsBin);
	loggingCommand(
		fixture,
		"node",
		`if [[ "\${1:-}" == "--version" ]]; then
		echo "v24.20.0"
	elif [[ "\${1:-}" == */pi-computer-use/scripts/setup-helper.mjs ]]; then
		true
	else
		exec ${JSON.stringify(process.execPath)} "$@"
	fi`,
	);
	loggingCommand(fixture, "uname", "echo Darwin");
	writeCommand(available, "uv", '[[ "${1:-}" == "--version" ]] && echo "uv 0.12.6"\ntrue');
	writeCommand(available, "gh", '[[ "${1:-}" == "--version" ]] && echo "gh version 2.98.0"\ntrue');
	writeCommand(available, "wt", '[[ "${1:-}" == "--version" ]] && echo "wt 0.75.0"\ntrue');
	writeCommand(available, "headroom", '[[ "${1:-}" == "--version" ]] && echo "headroom, version 0.39.1"\ntrue');
	writeCommand(available, "agent-browser", '[[ "${1:-}" == "--version" ]] && echo "agent-browser 0.34.0"\ntrue');
	writeCommand(
		fixture.bin,
		"mise",
		[
			`printf 'mise' >> ${JSON.stringify(fixture.log)}`,
			`printf '\\t%s' "$@" >> ${JSON.stringify(fixture.log)}`,
			`printf '\\n' >> ${JSON.stringify(fixture.log)}`,
			'case "$*" in',
			`  "use --global uv@0.12.6") cp ${JSON.stringify(join(available, "uv"))} ${JSON.stringify(join(toolsBin, "uv"))} ;;`,
			`  "use --global gh@2.98.0") cp ${JSON.stringify(join(available, "gh"))} ${JSON.stringify(join(toolsBin, "gh"))} ;;`,
			`  "use --global aqua:max-sixty/worktrunk@0.75.0") cp ${JSON.stringify(join(available, "wt"))} ${JSON.stringify(join(toolsBin, "wt"))} ;;`,
			`  "use --global pipx:headroom-ai[extras=all]@0.39.1") command -v uv >/dev/null; cp ${JSON.stringify(join(available, "headroom"))} ${JSON.stringify(join(toolsBin, "headroom"))} ;;`,
			`  "use --global npm:agent-browser@0.34.0") cp ${JSON.stringify(join(available, "agent-browser"))} ${JSON.stringify(join(toolsBin, "agent-browser"))} ;;`,
			`  "env -s bash") printf 'export PATH=%q\\n' ${JSON.stringify(`${toolsBin}:$PATH`)} ;;`,
			'esac',
			'[[ "${1:-}" != "which" ]] || command -v "${2:-}"',
		].join("\n"),
	);
	loggingCommand(
		fixture,
		"pi",
		`if [[ "\${1:-}" == "install" && "\${2:-}" == "npm:@injaneity/pi-computer-use@0.5.1" ]]; then
		mkdir -p "$HOME/.pi/agent"
		printf '%s\\n' '{"packages":["npm:@injaneity/pi-computer-use@0.5.1"]}' > "$HOME/.pi/agent/settings.json"
	fi
	if [[ "\${1:-}" == "list" ]]; then
		printf '%s\\n' 'npm:pi-agent-browser-native@0.5.0' 'npm:pi-codex-search@0.1.6' 'npm:@injaneity/pi-computer-use@0.5.1' ${JSON.stringify(fixture.root)}
	fi`,
	);
	loggingCommand(
		fixture,
		"npm",
		`[[ "\${1:-}" == "--version" ]] && echo "11.19.0"\n[[ "\${1:-}" != "exec" || "$PWD" != ${JSON.stringify(fixture.root)} ]] || { echo "doctor ran from the mypac checkout" >&2; exit 1; }`,
	);
}

function runSync(fixture, ...args) {
	return spawnSync("/bin/bash", [join(fixture.root, ".mise", "tasks", "sync.sh"), ...args], {
		cwd: fixture.root,
		env: { ...process.env, HOME: fixture.home, PATH: `${fixture.bin}:/usr/bin:/bin` },
		encoding: "utf8",
	});
}

test("sync rejects conflicting component pins before mutation", (t) => {
	const fixture = createSyncFixture(t);
	writeFileSync(
		join(fixture.root, ".mise", "global-environment"),
		"foundation mise node@24.20.0\nfoundation mise node@26.8.1\n",
	);
	installSyncCommands(fixture);

	const result = runSync(fixture, "validate");

	assert.equal(result.status, 1);
	assert.match(result.stderr, /duplicate desired-state component: mise node/);
	assert.equal(existsSync(fixture.log), false);
});

test("sync rejects an unknown phase before mutation", (t) => {
	const fixture = createSyncFixture(t);
	writeFileSync(
		join(fixture.root, ".mise", "global-environment"),
		"early mise node@24.20.0\n",
	);
	installSyncCommands(fixture);

	const result = runSync(fixture, "validate");

	assert.equal(result.status, 1);
	assert.match(result.stderr, /unknown desired-state phase: early/);
	assert.equal(existsSync(fixture.log), false);
});

test("sync setup refreshes stale hk hooks and rejects escaped newlines before committing", (t) => {
  const fixture = createSyncFixture(t);
  writeFileSync(join(fixture.root, ".mise", "global-environment"), "# No global components.\n");
  mkdirSync(join(fixture.root, ".config"));
  cpSync(hkConfigSource, join(fixture.root, ".config", "hk.pkl"));
  cpSync(hooksSource, join(fixture.root, ".mise", "tasks", "hooks.sh"));
  cpSync(messageCheckSource, join(fixture.root, "scripts", "check-commit-message.sh"));
  const gitEnv = {
    ...process.env,
    HOME: fixture.home,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    PATH: `${fixture.bin}:${process.env.PATH}`,
  };
  const git = (...args) => spawnSync("git", args, { cwd: fixture.root, env: gitEnv, encoding: "utf8" });
  assert.equal(git("init", "-q", "-b", "test-branch").status, 0);
  assert.equal(git("config", "user.name", "Test").status, 0);
  assert.equal(git("config", "user.email", "test@example.com").status, 0);
  // Older hk installation knows pre-commit, but not the newly configured commit-msg event.
  assert.equal(git("config", "hook.hk-pre-commit.event", "pre-commit").status, 0);
  assert.equal(git("config", "hook.hk-pre-commit.command", "true").status, 0);
  assert.notEqual(git("config", "--get", "hook.hk-commit-msg.event").status, 0);
  writeCommand(fixture.bin, "mise", `case "\${1:-}" in
    env) : ;;
    run) exec /bin/bash ${JSON.stringify(join(fixture.root, ".mise", "tasks", "hooks.sh"))} ;;
    x) shift 2; exec "$@" ;;
    *) exit 1 ;;
  esac`);
  const reconcile = () => spawnSync("/bin/bash", [join(fixture.root, ".mise", "tasks", "sync.sh"), "setup"], {
    cwd: fixture.root, env: gitEnv, encoding: "utf8",
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = reconcile();
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    assert.equal(git("config", "--get", "hook.hk-commit-msg.event").stdout.trim(), "commit-msg");
  }
  writeFileSync(join(fixture.root, "sample.txt"), "sample\n");
  assert.equal(git("add", "sample.txt").status, 0);
  const bad = git("commit", "-m", "Subject\\n\\nBody");
  assert.notEqual(bad.status, 0, `${bad.stdout}\n${bad.stderr}`);
  assert.match(bad.stdout + bad.stderr, /Refusing commit message containing literal/);
  assert.notEqual(git("rev-parse", "--verify", "HEAD").status, 0);
  const good = git("commit", "-m", "Subject", "-m", "Body");
  assert.equal(good.status, 0, `${good.stdout}\n${good.stderr}`);
  const raw = git("log", "-1", "--format=raw");
  assert.equal(raw.status, 0, raw.stderr);
  assert.match(raw.stdout, /\n    Subject\n    \n    Body\n/);
  assert.doesNotMatch(raw.stdout, /Subject\\n/);
});

test("sync reconciles and verifies the pinned global environment", (t) => {
	const fixture = createSyncFixture(t);
	installSyncCommands(fixture);

	const result = runSync(fixture);

	assert.equal(
		result.status,
		0,
		`${result.stderr}\n${result.stdout}\n${readFileSync(fixture.log, "utf8")}`,
	);
	assert.deepEqual(readFileSync(fixture.log, "utf8").trim().split("\n"), [
		"mise\tuse\t--global\tnode@24.20.0",
		"mise\tenv\t-s\tbash",
		"mise\tuse\t--global\tuv@0.12.6",
		"mise\tenv\t-s\tbash",
		"mise\tuse\t--global\tgh@2.98.0",
		"mise\tenv\t-s\tbash",
		"mise\tuse\t--global\taqua:max-sixty/worktrunk@0.75.0",
		"mise\tenv\t-s\tbash",
		"mise\tuse\t--global\tpipx:headroom-ai[extras=all]@0.39.1",
		"mise\tenv\t-s\tbash",
		"mise\tuse\t--global\tnpm:agent-browser@0.34.0",
		"mise\tenv\t-s\tbash",
		"pi\tinstall\tnpm:pi-agent-browser-native@0.5.0",
		"pi\tinstall\tnpm:pi-codex-search@0.1.6",
		"pi\tinstall\tnpm:@injaneity/pi-computer-use@0.5.1",
		`node\t${fixture.root}/scripts/configure-computer-use-opt-in.mjs\tnpm:@injaneity/pi-computer-use@0.5.1`,
		`pi\tinstall\t${fixture.root}`,
		"mise\tenv\t-s\tbash",
		"mise\trun\thooks",
		`mise\tset\t--global\tAGENT_BROWSER_SCREENSHOT_DIR=${fixture.home}/dev/agent-browser/screenshots`,
		"mise\tenv\t-s\tbash",
		"agent-browser\tinstall",
		"npm\texec\t--yes\t--package\tpi-agent-browser-native@0.5.0\t--\tpi-agent-browser-doctor",
		"uname\t-s",
		`node\t${fixture.home}/.pi/agent/npm/node_modules/@injaneity/pi-computer-use/scripts/setup-helper.mjs\t--runtime`,
		"mise\tenv\t-s\tbash",
		"mise\twhich\tnode",
		"node\t--version",
		"mise\twhich\tnpm",
		"npm\t--version",
		"mise\twhich\tuv",
		"uv\t--version",
		"mise\twhich\tgh",
		"gh\t--version",
		"mise\twhich\twt",
		"wt\t--version",
		"mise\twhich\theadroom",
		"headroom\t--version",
		"mise\twhich\tagent-browser",
		"agent-browser\t--version",
		"wt\tlist\t--format=json",
		"pi\tlist\t--no-approve",
		"pi\t--offline\t--no-approve\t--no-session\t--print",
	]);
});

test("sync installs computer use disabled by default", (t) => {
	const fixture = createSyncFixture(t);
	installSyncCommands(fixture);

	const result = runSync(fixture);

	assert.equal(result.status, 0, result.stderr);
	assert.match(readFileSync(fixture.log, "utf8"), /^pi\tinstall\tnpm:@injaneity\/pi-computer-use@0\.5\.1$/m);
	assert.match(
		readFileSync(fixture.log, "utf8"),
		new RegExp(`^node\\t${fixture.home}/\\.pi/agent/npm/node_modules/@injaneity/pi-computer-use/scripts/setup-helper\\.mjs\\t--runtime$`, "m"),
	);
	assert.deepEqual(
		JSON.parse(readFileSync(join(fixture.home, ".pi", "agent", "settings.json"), "utf8")),
		{
			packages: [
				{
					source: "npm:@injaneity/pi-computer-use@0.5.1",
					extensions: [],
				},
			],
		},
	);
});

test("sync stops after foundation when Pi is missing", (t) => {
	const fixture = createSyncFixture(t);
	installSyncCommands(fixture);
	rmSync(join(fixture.bin, "pi"));

	const result = runSync(fixture);

	assert.equal(result.status, 1);
	assert.match(result.stderr, /Pi is required/);
	assert.deepEqual(readFileSync(fixture.log, "utf8").trim().split("\n"), [
		"mise\tuse\t--global\tnode@24.20.0",
		"mise\tenv\t-s\tbash",
		"mise\tuse\t--global\tuv@0.12.6",
		"mise\tenv\t-s\tbash",
	]);
});

test("sync rejects npm from a different installation than the pinned Node executable", (t) => {
	const fixture = createSyncFixture(t);
	const otherInstallation = join(dirname(fixture.bin), "other-node", "bin", "npm");
	installSyncCommands(fixture, { npmMisePath: otherInstallation });

	const result = runSync(fixture, "verify");

	assert.equal(result.status, 1);
	assert.match(result.stderr, /npm must be supplied by the pinned mise-managed Node installation/);
	assert.doesNotMatch(readFileSync(fixture.log, "utf8"), /npm\t--version/);
});

test("sync rejects a shadowing non-mise Worktrunk executable", (t) => {
	const fixture = createSyncFixture(t);
	const miseOwnedBin = join(dirname(fixture.bin), "mise-owned");
	mkdirSync(miseOwnedBin);
	writeCommand(miseOwnedBin, "wt", 'echo "wt 0.75.0"');
	installSyncCommands(fixture, { wtMisePath: join(miseOwnedBin, "wt") });

	const result = runSync(fixture, "verify");

	assert.equal(result.status, 1);
	assert.match(result.stderr, /wt must resolve to the mise-owned executable/);
	assert.doesNotMatch(readFileSync(fixture.log, "utf8"), /wt\tlist\t--format=json/);
});

test("sync persists the browser screenshot directory through mise", (t) => {
	const fixture = createSyncFixture(t);
	const screenshotDir = join(fixture.home, "dev", "agent-browser", "screenshots");
	installSyncCommands(fixture);
	assert.equal(existsSync(screenshotDir), false);

	const result = runSync(fixture);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(existsSync(screenshotDir), true);
	assert.match(
		readFileSync(fixture.log, "utf8"),
		new RegExp(`mise\\tset\\t--global\\tAGENT_BROWSER_SCREENSHOT_DIR=${screenshotDir}$`, "m"),
	);
});

test("sync refreshes PATH between ordered mise declarations", (t) => {
	const fixture = createSyncFixture(t);
	installRefreshDependentCommands(fixture);
	const beforeSync = spawnSync("/bin/bash", ["-c", "command -v uv"], {
		env: { ...process.env, PATH: `${fixture.bin}:/usr/bin:/bin` },
	});
	assert.notEqual(beforeSync.status, 0, "uv must be absent before the first mise declaration");

	const result = runSync(fixture);

	assert.equal(
		result.status,
		0,
		`${result.stderr}\n${result.stdout}\n${readFileSync(fixture.log, "utf8")}`,
	);
	assert.match(readFileSync(fixture.log, "utf8"), /mise\tuse\t--global\tpipx:headroom-ai\[extras=all\]@0\.39\.1/);
});

test("sync applies a changed checked-in version and remains safe to rerun", (t) => {
	const fixture = createSyncFixture(t);
	const desiredState = join(fixture.root, ".mise", "global-environment");
	writeFileSync(
		desiredState,
		readFileSync(desiredState, "utf8").replace("uv@0.12.6", "uv@0.12.7"),
	);
	installSyncCommands(fixture, { uvVersion: "0.12.7" });

	const first = runSync(fixture);
	const firstCommands = readFileSync(fixture.log, "utf8");
	const second = runSync(fixture);
	const allCommands = readFileSync(fixture.log, "utf8");

	assert.equal(first.status, 0, first.stderr);
	assert.equal(second.status, 0, second.stderr);
	assert.match(firstCommands, /mise\tuse\t--global\tuv@0\.12\.7/);
	assert.equal(allCommands, firstCommands.repeat(2));
});

test("sync does not remove components deleted from desired state", (t) => {
	const fixture = createSyncFixture(t);
	writeFileSync(join(fixture.root, ".mise", "global-environment"), "# No global components declared.\n");
	installSyncCommands(fixture);

	const result = runSync(fixture);

	assert.equal(result.status, 0, result.stderr);
	const commands = readFileSync(fixture.log, "utf8");
	assert.equal(
		commands,
		[
			`pi\tinstall\t${fixture.root}`,
			"mise\tenv\t-s\tbash",
			"mise\trun\thooks",
			"mise\tenv\t-s\tbash",
			"pi\tlist\t--no-approve",
			"pi\t--offline\t--no-approve\t--no-session\t--print",
			"",
		].join("\n"),
	);
	assert.doesNotMatch(commands, /remove|uninstall/);
});

test("sync passes a checkout path containing spaces as one Pi argument", (t) => {
	const fixture = createSyncFixture(t, " with spaces");
	installSyncCommands(fixture);

	const result = runSync(fixture);

	assert.equal(result.status, 0, result.stderr);
	assert.match(readFileSync(fixture.log, "utf8"), new RegExp(`pi\\tinstall\\t${fixture.root}$`, "m"));
});

test("sync fails with actionable guidance when Pi is missing", (t) => {
	const fixture = createSyncFixture(t);
	loggingCommand(fixture, "mise");

	const result = runSync(fixture);

	assert.equal(result.status, 1);
	assert.match(result.stderr, /Pi is required/);
});
