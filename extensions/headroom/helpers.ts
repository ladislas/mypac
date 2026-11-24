import { streamSimpleOpenAICodexResponses as streamCodex } from "@earendil-works/pi-ai/compat";
import type { ProviderConfig } from "@earendil-works/pi-coding-agent";

export type HeadroomMode = "token" | "cache";
export type HeadroomAction = "wrap" | "stop" | "status";

export interface HeadroomOptions {
	action: HeadroomAction;
	port: number;
	mode: HeadroomMode;
	binary: string;
}

export interface ProviderOverride {
	provider: "openai-codex" | "openai" | "anthropic";
	config: ProviderConfig;
}

export const DEFAULT_HEADROOM_PORT = 8787;
export const DEFAULT_HEADROOM_MODE: HeadroomMode = "token";
export const DEFAULT_HEADROOM_BINARY = "headroom";

export function parseHeadroomArgs(args: string, env: NodeJS.ProcessEnv = process.env): HeadroomOptions {
	const tokens = tokenizeArgs(args);
	const action = parseAction(tokens.shift());
	let port = DEFAULT_HEADROOM_PORT;
	let mode = DEFAULT_HEADROOM_MODE;
	let invalidEnvPort = false;
	let invalidEnvMode = false;
	let hasPortOverride = false;
	let hasModeOverride = false;
	const envPort = env.HEADROOM_PORT?.trim();
	if (envPort) {
		const parsed = parsePort(envPort);
		if (parsed) port = parsed;
		else invalidEnvPort = true;
	}
	const envMode = env.HEADROOM_MODE?.trim();
	if (envMode) {
		const parsed = parseMode(envMode);
		if (parsed) mode = parsed;
		else invalidEnvMode = true;
	}
	let binary = env.HEADROOM_BIN?.trim() || DEFAULT_HEADROOM_BINARY;

	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index];
		if (token === "--port" || token === "-p") {
			const value = tokens[++index];
			const parsed = parsePort(value);
			if (!parsed) throw new Error("--port requires a valid port number");
			port = parsed;
			hasPortOverride = true;
			continue;
		}
		if (token?.startsWith("--port=")) {
			const parsed = parsePort(token.slice("--port=".length));
			if (!parsed) throw new Error("--port requires a valid port number");
			port = parsed;
			hasPortOverride = true;
			continue;
		}
		if (token === "--mode") {
			const parsed = parseMode(tokens[++index]);
			if (!parsed) throw new Error("--mode must be token or cache");
			mode = parsed;
			hasModeOverride = true;
			continue;
		}
		if (token?.startsWith("--mode=")) {
			const parsed = parseMode(token.slice("--mode=".length));
			if (!parsed) throw new Error("--mode must be token or cache");
			mode = parsed;
			hasModeOverride = true;
			continue;
		}
		if (token === "--bin" || token === "--binary") {
			const value = tokens[++index]?.trim();
			if (!value) throw new Error(`${token} requires binary path or command`);
			binary = value;
			continue;
		}
		if (token?.startsWith("--bin=")) {
			const value = token.slice("--bin=".length).trim();
			if (!value) throw new Error("--bin requires binary path or command");
			binary = value;
			continue;
		}
		if (token?.startsWith("--binary=")) {
			const value = token.slice("--binary=".length).trim();
			if (!value) throw new Error("--binary requires binary path or command");
			binary = value;
			continue;
		}
		if (token) throw new Error(`Unknown /headroom option: ${token}`);
	}

	if (action === "wrap" && invalidEnvPort && !hasPortOverride) throw new Error("HEADROOM_PORT must be a valid port number");
	if (action === "wrap" && invalidEnvMode && !hasModeOverride) throw new Error("HEADROOM_MODE must be token or cache");

	return { action, port, mode, binary };
}
export function buildProxyArgs(options: Pick<HeadroomOptions, "port" | "mode">): string[] {
	return ["proxy", "--port", String(options.port), "--mode", options.mode];
}

export function buildProviderOverrides(port: number, host = "127.0.0.1", codex = streamCodex): ProviderOverride[] {
	const base = `http://${host}:${port}`;
	return [
		{
			provider: "openai-codex",
			config: {
				baseUrl: `${base}/v1`,
				api: "openai-codex-responses",
				streamSimple: (model, context, options) => codex({ ...model, api: "openai-codex-responses" }, context, { ...options, transport: "sse" }),
			},
		},
		{ provider: "openai", config: { baseUrl: `${base}/v1` } },
		{ provider: "anthropic", config: { baseUrl: base } },
	];
}

export function getInstallGuidance(binary = DEFAULT_HEADROOM_BINARY): string {
	return [
		`Headroom binary not found: ${binary}`,
		"Install Headroom with uv, then try /headroom wrap again:",
		"",
		"  uv tool install --python 3.14 'headroom-ai[proxy]'",
		"",
		"If already installed, ensure the headroom command is on PATH or set HEADROOM_BIN.",
	].join("\n");
}

export function formatStatus(input: {
	enabled: boolean;
	managed: boolean;
	baseUrl: string;
	health?: unknown;
	stats?: unknown;
}): string {
	const lines = [
		`Headroom: ${input.enabled ? "enabled" : "disabled"}`,
		`Proxy: ${input.managed ? "managed by Pi" : "external or not managed"}`,
		`URL: ${input.baseUrl}`,
	];

	const health = input.health as { status?: unknown; ready?: unknown; version?: unknown } | undefined;
	if (health) {
		lines.push(`Health: ${String(health.status ?? "unknown")}${health.ready === false ? " (not ready)" : ""}`);
		if (health.version) lines.push(`Version: ${String(health.version)}`);
	} else {
		lines.push("Health: unreachable");
	}

	const stats = input.stats as { summary?: { api_requests?: unknown; compression?: { total_tokens_removed?: unknown; avg_compression_pct?: unknown } } } | undefined;
	if (stats?.summary) {
		lines.push(`Requests: ${String(stats.summary.api_requests ?? 0)}`);
		const compression = stats.summary.compression;
		if (compression) {
			lines.push(`Tokens removed: ${String(compression.total_tokens_removed ?? 0)}`);
			lines.push(`Average compression: ${String(compression.avg_compression_pct ?? 0)}%`);
		}
	}

	return lines.join("\n");
}

function parseAction(token: string | undefined): HeadroomAction {
	if (!token || token === "status") return "status";
	if (token === "wrap" || token === "on" || token === "start") return "wrap";
	if (token === "stop" || token === "off") return "stop";
	throw new Error("Usage: /headroom wrap|stop|status [--port <port>] [--mode token|cache] [--bin <headroom>]");
}

function parsePort(value: string | undefined): number | null {
	if (!value) return null;
	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
	return port;
}

function parseMode(value: string | undefined): HeadroomMode | null {
	if (value === "token" || value === "cache") return value;
	return null;
}

function tokenizeArgs(args: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let quote: '"' | "'" | null = null;

	for (let index = 0; index < args.length; index++) {
		const char = args[index];

		if (quote) {
			if (char === "\\" && index + 1 < args.length) {
				current += args[index + 1];
				index += 1;
				continue;
			}
			if (char === quote) {
				quote = null;
				continue;
			}
			current += char;
			continue;
		}

		if (char === "\\" && index + 1 < args.length) {
			current += args[index + 1];
			index += 1;
			continue;
		}

		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}

		if (/\s/.test(char)) {
			if (current.length > 0) {
				tokens.push(current);
				current = "";
			}
			continue;
		}

		current += char;
	}

	if (current.length > 0) {
		tokens.push(current);
	}

	return tokens;
}
