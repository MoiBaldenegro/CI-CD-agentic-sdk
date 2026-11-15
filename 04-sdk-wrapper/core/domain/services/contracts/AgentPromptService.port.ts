import type { AgentPrimitives } from "../../Agent.entity.js";
import type { AgentPrompt, AgentResponse } from "../../outbound/AgentGateway.port.js";

export interface AgentPromptServicePort {
  validateAgent(agent: AgentPrimitives): void;
  validatePrompt(prompt: AgentPrompt): void;
  validateResponse(response: AgentResponse): void;
  send(agent: AgentPrimitives, prompt: AgentPrompt): Promise<AgentResponse>;
}
