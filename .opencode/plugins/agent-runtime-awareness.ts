import { tool, type Plugin } from "@opencode-ai/plugin";

type ModelMetadata = {
  providerID: string;
  modelID: string;
  id: string;
};

type SessionRuntimeState = {
  currentAgent?: string;
  lastEffectiveAgent?: string;
  previousAgent?: string;
  activeModel?: ModelMetadata;
  effectiveTurnMessageID?: string;
  updatedAt?: string;
};

type PolicyClassification = "build" | "non-build" | "unknown";

type AgentLike =
  | string
  | {
      name?: string;
      id?: string;
    }
  | null
  | undefined;

const runtimeStateBySession = new Map<string, SessionRuntimeState>();
const BUILD_AGENTS = new Set(["RickBuild", "build"]);
const MUTATION_TOOL_IDS = new Set(["edit", "write", "patch", "apply_patch"]);
const SHELL_TOOL_IDS = new Set(["bash", "shell"]);
const NON_BUILD_ALLOWED_SHELL_PATTERNS = [
  /^git\s+(status|diff|log|show|branch|rev-parse|ls-files)\b/,
  /^(grep|rg)\b/,
  /^(ls|head|tail|wc|file|tree)\b/,
  /^openspec\b/,
  /^gh\s+auth\s+status\b/,
  /^gh\s+repo\s+view\b/,
  /^gh\s+issue\s+(list|view|create|edit|close)\b/,
  /^gh\s+label\s+list\b/,
  /^gh\s+label\s+create\s+"needs triage"\b/,
];

function ensureSessionState(sessionID: string) {
  let state = runtimeStateBySession.get(sessionID);
  if (!state) {
    state = {};
    runtimeStateBySession.set(sessionID, state);
  }
  return state;
}

function setActiveModel(
  state: SessionRuntimeState,
  model?: { providerID: string; modelID: string } | { providerID: string; id: string },
) {
  if (!model) {
    return;
  }

  const modelID = "modelID" in model ? model.modelID : model.id;
  state.activeModel = {
    providerID: model.providerID,
    modelID,
    id: `${model.providerID}/${modelID}`,
  };
}

function touchState(state: SessionRuntimeState) {
  state.updatedAt = new Date().toISOString();
}

function normalizeAgent(agent: AgentLike) {
  if (typeof agent === "string") {
    const normalized = agent.trim();
    return normalized || undefined;
  }

  if (!agent || typeof agent !== "object") {
    return undefined;
  }

  if (typeof agent.name === "string") {
    const normalized = agent.name.trim();
    if (normalized) {
      return normalized;
    }
  }

  if (typeof agent.id === "string") {
    const normalized = agent.id.trim();
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function applyRuntimeAgent(state: SessionRuntimeState, agent: string) {
  const lastEffectiveAgent = state.lastEffectiveAgent;

  state.currentAgent = agent;
  state.previousAgent = lastEffectiveAgent && lastEffectiveAgent !== agent ? lastEffectiveAgent : undefined;
}

function classifyPolicy(agent?: string): PolicyClassification {
  const normalizedAgent = normalizeAgent(agent);
  if (!normalizedAgent) {
    return "unknown";
  }

  return BUILD_AGENTS.has(normalizedAgent) ? "build" : "non-build";
}

function getPolicyAgent(sessionID: string) {
  const state = ensureSessionState(sessionID);
  return normalizeAgent(state.currentAgent) || normalizeAgent(state.lastEffectiveAgent);
}

function getPolicySummary(agent?: string) {
  return {
    agent: agent ?? null,
    policyClassification: classifyPolicy(agent),
  };
}

function denyToolExecution(tool: string, agent?: string, reason?: string): never {
  const summary = getPolicySummary(agent);
  const details = [
    `Tool '${tool}' is denied for non-build agent '${summary.agent ?? "unknown"}'.`,
    reason,
    "Switch to RickBuild or build for implementation work.",
  ]
    .filter(Boolean)
    .join(" ");

  throw new Error(details);
}

function getShellCommand(args: unknown) {
  if (!args || typeof args !== "object") {
    return undefined;
  }

  if ("command" in args && typeof args.command === "string") {
    return args.command.trim();
  }

  if ("cmd" in args && typeof args.cmd === "string") {
    return args.cmd.trim();
  }

  return undefined;
}

function isAllowedNonBuildShellCommand(command: string) {
  return NON_BUILD_ALLOWED_SHELL_PATTERNS.some((pattern) => pattern.test(command));
}

function getRuntimeSnapshot(sessionID: string) {
  const state = ensureSessionState(sessionID);
  const policyAgent = getPolicyAgent(sessionID);

  return {
    currentAgent: state.currentAgent ?? null,
    previousAgent: state.previousAgent ?? null,
    activeModel: state.activeModel ?? null,
    policyAgent: policyAgent ?? null,
    policyClassification: classifyPolicy(policyAgent),
  };
}

function buildSyntheticRuntimeContext(state: SessionRuntimeState) {
  const currentAgent = normalizeAgent(state.currentAgent) || normalizeAgent(state.lastEffectiveAgent);
  if (!currentAgent) {
    return;
  }

  const summary = [`Runtime: agent=${currentAgent}`];

  if (state.previousAgent) {
    summary.push(`previous=${state.previousAgent}`);
  }

  if (state.activeModel?.id) {
    summary.push(`model=${state.activeModel.id}`);
  }

  const lines = [summary.join(" ")];

  if (state.previousAgent) {
    lines.push(
      `Handoff: prior assistant outputs may reflect ${state.previousAgent}; treat them as historical outputs, not your current identity.`,
    );
  }

  return lines.join("\n");
}

function recordEffectiveTurn(input: {
  sessionID: string;
  agent?: AgentLike;
  messageID?: string;
  model?: { providerID: string; modelID: string };
}) {
  const state = ensureSessionState(input.sessionID);
  const agent = normalizeAgent(input.agent);
  const priorEffectiveAgent = normalizeAgent(state.currentAgent) || normalizeAgent(state.lastEffectiveAgent);

  if (priorEffectiveAgent) {
    state.lastEffectiveAgent = priorEffectiveAgent;
  }

  if (agent) {
    applyRuntimeAgent(state, agent);
  }

  if (input.messageID) {
    state.effectiveTurnMessageID = input.messageID;
  }

  setActiveModel(state, input.model);
  touchState(state);
}

function refreshActiveRuntime(input: {
  sessionID: string;
  agent?: AgentLike;
  model?: { providerID: string; id: string };
}) {
  const state = ensureSessionState(input.sessionID);

  const agent = normalizeAgent(input.agent);

  if (agent) {
    applyRuntimeAgent(state, agent);
  }

  setActiveModel(state, input.model);
  touchState(state);
}

export const AgentRuntimeAwarenessPlugin: Plugin = async () => {
  return {
    tool: {
      runtime_introspection: tool({
        description: "Return current runtime awareness context",
        args: {},
        async execute(_args, context) {
          const snapshot = getRuntimeSnapshot(context.sessionID);
          context.metadata({
            title: "Runtime introspection",
            metadata: snapshot,
          });
          return JSON.stringify(snapshot, null, 2);
        },
      }),
    },
    "chat.message": async (input) => {
      recordEffectiveTurn(input);
    },
    "chat.params": async (input) => {
      refreshActiveRuntime(input);
    },
    "experimental.chat.system.transform": async (input, output) => {
      if (!input.sessionID) {
        return;
      }

      const state = ensureSessionState(input.sessionID);
      setActiveModel(state, input.model);

      const runtimeContext = buildSyntheticRuntimeContext(state);
      if (!runtimeContext) {
        return;
      }

      output.system.push(runtimeContext);
    },
    "tool.execute.before": async (input, output) => {
      const agent = getPolicyAgent(input.sessionID);
      if (classifyPolicy(agent) !== "non-build") {
        return;
      }

      if (MUTATION_TOOL_IDS.has(input.tool)) {
        denyToolExecution(
          input.tool,
          agent,
          "Non-build agents are read-only and cannot mutate files.",
        );
      }

      if (!SHELL_TOOL_IDS.has(input.tool)) {
        return;
      }

      const command = getShellCommand(output.args);
      if (!command) {
        denyToolExecution(
          input.tool,
          agent,
          "Shell access for non-build agents requires an explicit allowed analysis command.",
        );
      }

      if (!isAllowedNonBuildShellCommand(command)) {
        denyToolExecution(
          input.tool,
          agent,
          `Command '${command}' is outside the allowed analysis and scoped GitHub issue workflows.`,
        );
      }
    },
  };
};
