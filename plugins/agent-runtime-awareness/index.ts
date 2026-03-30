import { tool, type Plugin } from "@opencode-ai/plugin";

type ModelMetadata = {
  providerID: string;
  modelID: string;
  id: string;
};

type SessionRuntimeState = {
  // Agent that is currently active (may include transient picker selections).
  currentAgent?: string;
  // Agent that handled the last confirmed user turn (set in chat.message only).
  lastEffectiveAgent?: string;
  // Ephemeral: the previous effective agent on a real handoff turn.
  // Set in recordEffectiveTurn, cleared by system.transform after injection.
  previousAgent?: string;
  // Permanent: the last real handoff source. Never cleared.
  // Used by introspection so the tool always reflects the last real switch.
  lastHandoffAgent?: string;
  activeModel?: ModelMetadata;
  updatedAt?: string;
};

type AgentLike =
  | string
  | {
      name?: string;
      id?: string;
    }
  | null
  | undefined;

const runtimeStateBySession = new Map<string, SessionRuntimeState>();
const MAX_SESSIONS_BEFORE_PRUNE = 1000;

function pruneSessionState() {
  if (runtimeStateBySession.size < MAX_SESSIONS_BEFORE_PRUNE) {
    return;
  }

  const oldestSession = runtimeStateBySession.entries().next().value?.[0];
  if (oldestSession) {
    runtimeStateBySession.delete(oldestSession);
  }
}

function ensureSessionState(sessionID: string) {
  let state = runtimeStateBySession.get(sessionID);
  if (!state) {
    pruneSessionState();
    state = {};
    runtimeStateBySession.set(sessionID, state);
  }
  return state;
}

function normalizeAgent(agent: AgentLike): string | undefined {
  if (typeof agent === "string") {
    const normalized = agent.trim();
    return normalized || undefined;
  }

  if (!agent || typeof agent !== "object") {
    return undefined;
  }

  if (typeof agent.name === "string") {
    const normalized = agent.name.trim();
    if (normalized) return normalized;
  }

  if (typeof agent.id === "string") {
    const normalized = agent.id.trim();
    if (normalized) return normalized;
  }

  return undefined;
}

function setActiveModel(
  state: SessionRuntimeState,
  model?: { providerID: string; modelID: string } | { providerID: string; id: string },
) {
  if (!model) return;

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

// Called only from chat.message — the authoritative confirmed-turn hook.
// previousAgent and lastHandoffAgent are only mutated here, never in
// refreshActiveRuntime, so transient picker changes cannot affect handoff semantics.
function recordEffectiveTurn(input: {
  sessionID: string;
  agent?: AgentLike;
  model?: { providerID: string; modelID: string };
}) {
  const state = ensureSessionState(input.sessionID);
  const agent = normalizeAgent(input.agent);

  if (agent) {
    state.currentAgent = agent;

    if (state.lastEffectiveAgent && state.lastEffectiveAgent !== agent) {
      // Real handoff: record who we're coming from.
      state.previousAgent = state.lastEffectiveAgent;
      state.lastHandoffAgent = state.lastEffectiveAgent;
    } else {
      // Continuation or first turn: no handoff.
      // Clear lastHandoffAgent so introspection returns null once the
      // incoming agent has completed its own first confirmed turn.
      state.previousAgent = undefined;
      state.lastHandoffAgent = undefined;
    }

    state.lastEffectiveAgent = agent;
  }

  setActiveModel(state, input.model);
  touchState(state);
}

// Called from chat.params — transient picker updates only.
// Updates currentAgent for display/context but does NOT touch
// previousAgent, lastHandoffAgent, or lastEffectiveAgent.
function refreshActiveRuntime(input: {
  sessionID: string;
  agent?: AgentLike;
  model?: { providerID: string; id: string };
}) {
  const state = ensureSessionState(input.sessionID);

  const agent = normalizeAgent(input.agent);
  if (agent) {
    state.currentAgent = agent;
  }

  setActiveModel(state, input.model);
  touchState(state);
}

function buildSyntheticRuntimeContext(state: SessionRuntimeState) {
  const currentAgent = normalizeAgent(state.currentAgent) || normalizeAgent(state.lastEffectiveAgent);
  if (!currentAgent) return;

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

function getRuntimeSnapshot(sessionID: string) {
  const state = ensureSessionState(sessionID);

  return {
    currentAgent: state.currentAgent ?? null,
    // Populated only during the handoff turn (the first turn of the new agent).
    // Null on session start, same-agent continuation, and after the new agent
    // completes its own first confirmed turn. Uses lastHandoffAgent so introspection
    // is correct even after system.transform has cleared the ephemeral previousAgent.
    previousAgent: state.lastHandoffAgent ?? null,
    lastEffectiveAgent: state.lastEffectiveAgent ?? null,
    activeModel: state.activeModel ?? null,
  };
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
      if (!input.sessionID) return;

      const state = ensureSessionState(input.sessionID);
      setActiveModel(state, input.model);

      const runtimeContext = buildSyntheticRuntimeContext(state);
      if (!runtimeContext) return;

      output.system.push(runtimeContext);

      // Clear previousAgent after injection so the handoff frame is not
      // repeated on subsequent turns with the same effective agent.
      state.previousAgent = undefined;
    },
  };
};

export default AgentRuntimeAwarenessPlugin;
