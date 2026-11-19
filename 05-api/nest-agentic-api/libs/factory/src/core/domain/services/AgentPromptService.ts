import type { AgentPrimitives } from '../Agent.entity.js';
import { DomainValidationError } from '../exceptions/DomainValidationError.js';
import type {
  AgentGateway,
  AgentPrompt,
  AgentResponse,
} from '../outbound/AgentGateway.port.js';
import type { AgentPromptServicePort } from './contracts/AgentPromptService.port.js';

export class AgentPromptService implements AgentPromptServicePort {
  constructor(private readonly gateway: AgentGateway) {}

  validateAgent(agent: AgentPrimitives): void {
    if (agent.id.trim().length === 0) {
      throw new DomainValidationError(
        'AGENT_ID_EMPTY',
        'Agent id must not be empty',
      );
    }
  }

  validatePrompt(prompt: AgentPrompt): void {
    if (prompt.text.trim().length === 0) {
      throw new DomainValidationError(
        'AGENT_PROMPT_EMPTY',
        'Agent prompt must not be empty',
      );
    }
  }

  validateResponse(response: AgentResponse): void {
    if (response.text.trim().length === 0) {
      throw new DomainValidationError(
        'AGENT_RESPONSE_EMPTY',
        'Agent response must not be empty',
      );
    }
  }

  async send(
    agent: AgentPrimitives,
    prompt: AgentPrompt,
  ): Promise<AgentResponse> {
    this.validateAgent(agent);
    this.validatePrompt(prompt);

    const response = await this.gateway.sendPrompt(agent, {
      text: prompt.text.trim(),
      workingDirectory: prompt.workingDirectory,
    });

    this.validateResponse(response);
    return response;
  }
}
