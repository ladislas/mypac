import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";
import { CURRENT_SESSION_VERSION, type ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import type { ThinkingLevelSetting } from "./settings.ts";

type SwitchSessionOptions = NonNullable<Parameters<ExtensionCommandContext["switchSession"]>[1]>;
type WithSessionCallback = SwitchSessionOptions["withSession"];

export type WorkflowSessionSeed = {
	cwd: string;
	sessionDir: string;
	parentSession?: string;
	sessionName?: string;
	model: {
		provider: string;
		id: string;
	};
	thinkingLevel: ThinkingLevelSetting;
	customEntries?: Array<{
		customType: string;
		data?: unknown;
	}>;
};

export type SeededWorkflowSwitchOptions = WorkflowSessionSeed & {
	withSession?: WithSessionCallback;
};

export async function createSeededWorkflowSessionFile(seed: WorkflowSessionSeed): Promise<string> {
	const timestamp = new Date().toISOString();
	const sessionFile = path.join(seed.sessionDir, `${toFileTimestamp(timestamp)}_${randomUUID()}.jsonl`);
	const lines: string[] = [];
	const sessionId = randomUUID();

	lines.push(
		JSON.stringify({
			type: "session",
			version: CURRENT_SESSION_VERSION,
			id: sessionId,
			timestamp,
			cwd: seed.cwd,
			...(seed.parentSession ? { parentSession: seed.parentSession } : {}),
		}),
	);

	let parentId: string | null = null;
	parentId = pushLine(lines, {
		type: "model_change",
		id: createEntryId(),
		parentId,
		timestamp,
		provider: seed.model.provider,
		modelId: seed.model.id,
	});
	parentId = pushLine(lines, {
		type: "thinking_level_change",
		id: createEntryId(),
		parentId,
		timestamp,
		thinkingLevel: seed.thinkingLevel,
	});

	if (seed.sessionName) {
		parentId = pushLine(lines, {
			type: "session_info",
			id: createEntryId(),
			parentId,
			timestamp,
			name: seed.sessionName,
		});
	}

	for (const customEntry of seed.customEntries ?? []) {
		parentId = pushLine(lines, {
			type: "custom",
			id: createEntryId(),
			parentId,
			timestamp,
			customType: customEntry.customType,
			data: customEntry.data,
		});
	}

	await fs.mkdir(seed.sessionDir, { recursive: true });
	await fs.writeFile(sessionFile, `${lines.join("\n")}\n`, "utf8");
	return sessionFile;
}

export async function switchToSeededWorkflowSession(
	ctx: ExtensionCommandContext,
	options: SeededWorkflowSwitchOptions,
): Promise<{ cancelled: boolean; sessionFile: string }> {
	const sessionFile = await createSeededWorkflowSessionFile(options);
	const result = await ctx.switchSession(sessionFile, { withSession: options.withSession });
	return { cancelled: result.cancelled, sessionFile };
}

function pushLine(lines: string[], entry: Record<string, unknown> & { id: string }): string {
	lines.push(JSON.stringify(entry));
	return entry.id;
}

function createEntryId(): string {
	return randomBytes(4).toString("hex");
}

function toFileTimestamp(timestamp: string): string {
	return timestamp.replace(/[.:]/g, "-");
}
