import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const result = readFileSync("evaluations/headroom-ccr-recovery/workspace/result.md", "utf8");
assert.match(result, /\b17\b/);
assert.match(result, /\bamber\b/i);
assert.match(result, /\bbuoys?\b/i);
assert.match(result, /(?:ccr|marker).*(?:presentation|compression|transport)|(?:presentation|compression|transport).*(?:ccr|marker)/is);
assert.doesNotMatch(result, /(?:source|file|artifact)\s+(?:is|was)\s+(?:missing|unavailable)|(?:please|can you|could you)\s+paste/i);
