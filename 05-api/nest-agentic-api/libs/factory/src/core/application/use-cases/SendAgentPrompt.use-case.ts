import { Logger } from '@nestjs/common';
import type { AgentPrimitives } from '../../domain/Agent.entity.js';
import type {
  AgentPrompt,
  AgentResponse,
} from '../../domain/outbound/AgentGateway.port.js';
import type { AgentPromptServicePort } from '../../domain/services/contracts/AgentPromptService.port.js';

export class SendAgentPromptUseCase {
  private readonly logger = new Logger(SendAgentPromptUseCase.name);

  constructor(private readonly agentPromptService: AgentPromptServicePort) {}

  async execute(
    agent: AgentPrimitives,
    prompt: AgentPrompt,
  ): Promise<AgentResponse> {
    this.logger.log(
      `Enviando prompt a ${agent.provider}:${agent.agentId} (chars=${prompt.text?.length ?? 0})`,
    );

    const response = await this.agentPromptService.send(agent, prompt);

    this.logger.log(
      `Respuesta recibida de ${agent.provider}:${agent.agentId} (chars=${response.text.length}, sessionId=${response.sessionId ?? 'n/a'})`,
    );

    return response;
  }
}
