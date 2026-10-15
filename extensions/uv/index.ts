/**
 * UV Extension - Redirects Python tooling to uv equivalents
 *
 * This extension wraps the bash tool to prepend uv's intercepted-commands to PATH,
 * which contains shim scripts that intercept common Python tooling commands
 * and redirect agents to use uv instead.
 *
 * Intercepted commands:
 * - pip/pip3: Blocked with suggestions to use `uv add` or `uv run --with`
 * - poetry: Blocked with uv equivalents (uv init, uv add, uv sync, uv run)
 * - python/python3: Redirected through `uv run` to a real interpreter path,
 *   with special handling to block `python -m pip`, `python -m venv`, and
 *   `python -m py_compile`
 *
 * The shim scripts are colocated in this extension's intercepted-commands
 * directory and provide helpful error messages with the equivalent uv commands.
 *
 * Note: PATH shims are bypassable via explicit interpreter paths
 * (for example `.venv/bin/python`). To close that gap, this extension also
 * checks parsed Bash command nodes before execution. See README.md for limits.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createBashTool, createLocalBashOperations } from "@earendil-works/pi-coding-agent";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getBlockedCommandMessage } from "./helpers.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const interceptedCommandsPath = join(__dirname, "intercepted-commands");

export default function (pi: ExtensionAPI) {
  const cwd = process.cwd();
  const operations = createLocalBashOperations();
  const bashTool = createBashTool(cwd, {
    commandPrefix: `export PATH="${interceptedCommandsPath}:$PATH"`,
    operations: {
      async exec(command, cwd, options) {
        const blockedMessage = await getBlockedCommandMessage(command);
        if (blockedMessage) throw new Error(blockedMessage);
        return operations.exec(command, cwd, options);
      },
    },
  });

  pi.registerTool(bashTool);
}
