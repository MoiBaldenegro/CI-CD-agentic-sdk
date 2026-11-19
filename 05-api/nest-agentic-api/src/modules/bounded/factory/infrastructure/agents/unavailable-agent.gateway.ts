import { Injectable } from '@nestjs/common';
import {
  DomainValidationError,
  type AgentGateway,
  type AgentResponse,
} from 'lib/factory';

@Injectable()
export class UnavailableAgentGateway implements AgentGateway {
  async sendPrompt(): Promise<AgentResponse> {
    throw new DomainValidationError(
      'AGENT_GATEWAY_NOT_CONFIGURED',
      'No agent gateway is configured',
    );
  }
}
