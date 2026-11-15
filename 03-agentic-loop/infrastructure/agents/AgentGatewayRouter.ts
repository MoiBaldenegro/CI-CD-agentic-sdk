import { DomainException } from "../../shared/DomainException.js";
import type {
  AgentExecutionRequest,
  AgentExecutionResult,
  AgentGateway,
} from "../../core/domain/outbound/AgentGateway.port.js";

export interface AgentAdapter {
  readonly provider: string;
  execute(request: AgentExecutionRequest): Promise<AgentExecutionResult>;
}

export class AgentNotRegisteredError extends DomainException {
  readonly statusCode = 503;
  readonly provider: string;

  constructor(provider: string) {
    super("AGENT_NOT_REGISTERED", `No agent adapter registered for provider "${provider}"`, {
      provider,
    });
    this.provider = provider;
  }
}

export class AgentGatewayRouter implements AgentGateway {
  private readonly adapters = new Map<string, AgentAdapter>();

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  unregister(provider: string): boolean {
    return this.adapters.delete(provider);
  }

  registeredProviders(): readonly string[] {
    return [...this.adapters.keys()];
  }

  async execute(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    const adapter = this.adapters.get(request.agent.provider);

    if (adapter === undefined) {
      throw new AgentNotRegisteredError(request.agent.provider);
    }

    return adapter.execute(request);
  }
}
