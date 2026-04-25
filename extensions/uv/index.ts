/**
 * UV Extension - Redirects Python tooling to uv equivalents
 * Original source: https://github.com/mitsuhiko/agent-stuff/blob/main/extensions/uv.ts
 *
 * This extension wraps the bash tool to prepend intercepted-commands to PATH,
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
 * The shim scripts are located in the intercepted-commands directory and
 * provide helpful error messages with the equivalent uv commands.
 *
 * Note: PATH shims are bypassable via explicit interpreter paths
 * (for example `.venv/bin/python`). To close that gap, this extension also
 * blocks disallowed invocations at bash spawn time.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createBashTool } from "@mariozechner/pi-coding-agent";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getBlockedCommandMessage } from "./helpers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const interceptedCommandsPath = join(__dirname, "..", "..", "intercepted-commands");

export default function (pi: ExtensionAPI) {
  const cwd = process.cwd();
  const bashTool = createBashTool(cwd, {
    commandPrefix: `export PATH="${interceptedCommandsPath}:$PATH"`,
    spawnHook: (ctx) => {
      const blockedMessage = getBlockedCommandMessage(ctx.command);
      if (blockedMessage) {
        throw new Error(blockedMessage);
      }
      return ctx;
    },
  });

  pi.registerTool(bashTool);
}
