import type { AgentPrimitives } from "../Agent.entity.js";

export interface AgentPrompt {
  readonly text: string;
}

export interface AgentResponse {
  readonly text: string;
  readonly sessionId: string | null;
}

export interface AgentGateway {
  sendPrompt(agent: AgentPrimitives, prompt: AgentPrompt): Promise<AgentResponse>;
}
