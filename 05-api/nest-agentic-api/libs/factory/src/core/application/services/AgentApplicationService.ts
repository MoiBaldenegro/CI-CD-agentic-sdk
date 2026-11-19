import type { AgentPrimitives } from '../../domain/Agent.entity.js';
import type {
  AgentPrompt,
  AgentResponse,
} from '../../domain/outbound/AgentGateway.port.js';
import { SendAgentPromptUseCase } from '../use-cases/SendAgentPrompt.use-case.js';

export class AgentApplicationService {
  constructor(
    private readonly sendAgentPromptUseCase: SendAgentPromptUseCase,
  ) {}

  sendPrompt(
    agent: AgentPrimitives,
    prompt: AgentPrompt,
  ): Promise<AgentResponse> {
    return this.sendAgentPromptUseCase.execute(agent, prompt);
  }
}
