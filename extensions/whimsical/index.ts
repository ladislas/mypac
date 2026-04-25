/**
 * Original source: https://github.com/mitsuhiko/agent-stuff/blob/main/extensions/whimsical.ts
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { pickRandom } from "./helpers.ts";

export default function (pi: ExtensionAPI) {
  pi.on("turn_start", async (_event, ctx) => {
    ctx.ui.setWorkingMessage(pickRandom());
  });

  pi.on("turn_end", async (_event, ctx) => {
    ctx.ui.setWorkingMessage(); // Reset for next time
  });
}
