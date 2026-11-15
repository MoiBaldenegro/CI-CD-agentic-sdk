import { DomainValidationError } from "./exceptions/DomainValidationError.js";

export interface AgentProps {
  id: string;
  provider: string;
  agentId: string;
  model: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentProps {
  readonly provider: string;
  readonly agentId: string;
  readonly model?: string | null;
}

export interface AgentPrimitives {
  id: string;
  provider: string;
  agentId: string;
  model: string | null;
  createdAt: string;
  updatedAt: string;
}

export class Agent {
  private readonly props: AgentProps;

  private constructor(props: AgentProps) {
    this.props = { ...props };
  }

  static create(props: CreateAgentProps): AgentPrimitives {
    const provider = props.provider.trim().toLowerCase();
    const agentId = props.agentId.trim();
    const model = props.model?.trim() || null;

    if (provider.length === 0) {
      throw new DomainValidationError("AGENT_PROVIDER_EMPTY", "Agent provider must not be empty");
    }

    if (agentId.length === 0) {
      throw new DomainValidationError("AGENT_ID_EMPTY", "Agent id must not be empty");
    }

    const now = new Date();
    const agent = new Agent({
      id: globalThis.crypto.randomUUID(),
      provider,
      agentId,
      model,
      createdAt: now,
      updatedAt: now,
    });

    return agent.toPrimitives();
  }

  toPrimitives(): AgentPrimitives {
    return {
      id: this.props.id,
      provider: this.props.provider,
      agentId: this.props.agentId,
      model: this.props.model,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }
}
