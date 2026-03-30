import type { Plugin } from "@opencode-ai/plugin";

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

const runtimeStateBySession = new Map<string, SessionRuntimeState>();

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

function recordEffectiveTurn(input: {
  sessionID: string;
  agent?: string;
  messageID?: string;
  model?: { providerID: string; modelID: string };
}) {
  const state = ensureSessionState(input.sessionID);
  const agent = input.agent?.trim();

  if (agent) {
    const lastEffectiveAgent = state.lastEffectiveAgent;

    state.currentAgent = agent;
    state.previousAgent = lastEffectiveAgent && lastEffectiveAgent !== agent ? lastEffectiveAgent : undefined;
    state.lastEffectiveAgent = agent;
  }

  if (input.messageID) {
    state.effectiveTurnMessageID = input.messageID;
  }

  setActiveModel(state, input.model);
  touchState(state);
}

function refreshActiveRuntime(input: {
  sessionID: string;
  agent?: string;
  model?: { providerID: string; id: string };
}) {
  const state = ensureSessionState(input.sessionID);

  if (input.agent?.trim()) {
    state.currentAgent = input.agent.trim();
  }

  setActiveModel(state, input.model);
  touchState(state);
}

export const AgentRuntimeAwarenessPlugin: Plugin = async () => {
  return {
    "chat.message": async (input) => {
      recordEffectiveTurn(input);
    },
    "chat.params": async (input) => {
      refreshActiveRuntime(input);
    },
  };
};
