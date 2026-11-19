import { Injectable } from '@nestjs/common';
import type {
  AgentGateway,
  AgentPrimitives,
  AgentPrompt,
  AgentResponse,
} from 'lib/factory';

@Injectable()
export class SimulatedAgentGateway implements AgentGateway {
  async sendPrompt(
    agent: AgentPrimitives,
    prompt: AgentPrompt,
  ): Promise<AgentResponse> {
    return {
      text: `[simulated ${agent.provider}:${agent.agentId}] ${prompt.text}`,
      sessionId: null,
    };
  }
}
