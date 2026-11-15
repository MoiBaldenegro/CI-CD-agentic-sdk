import type { AgentPrimitives } from "../../domain/Agent.entity.js";
import type {
  AgentPrompt,
  AgentResponse,
} from "../../domain/outbound/AgentGateway.port.js";
import type { AgentPromptServicePort } from "../../domain/services/contracts/AgentPromptService.port.js";

export class SendAgentPromptUseCase {
  constructor(private readonly agentPromptService: AgentPromptServicePort) {}

  execute(agent: AgentPrimitives, prompt: AgentPrompt): Promise<AgentResponse> {
    return this.agentPromptService.send(agent, prompt);
  }
}
