import { DomainValidationError } from '../../exceptions/DomainValidationError.js';
import { ValueObject } from '../ValueObject.js';

const PROVIDER_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const AGENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,99}$/;
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

interface AgentRefProps extends Record<string, unknown> {
  readonly provider: string;
  readonly agentId: string;
  readonly model: string | null;
}

export class AgentRef extends ValueObject<AgentRefProps> {
  private constructor(provider: string, agentId: string, model: string | null) {
    super({ provider, agentId, model });
  }

  static from(
    provider: string,
    agentId: string,
    model: string | null = null,
  ): AgentRef {
    const normalizedProvider = provider.trim().toLowerCase();
    const normalizedAgentId = agentId.trim();

    if (!PROVIDER_PATTERN.test(normalizedProvider)) {
      throw new DomainValidationError(
        'AGENT_PROVIDER_INVALID',
        'Agent provider must be a lowercase slug',
        { provider },
      );
    }

    if (!AGENT_ID_PATTERN.test(normalizedAgentId)) {
      throw new DomainValidationError(
        'AGENT_ID_INVALID',
        'Agent id is invalid',
        { agentId },
      );
    }

    return new AgentRef(
      normalizedProvider,
      normalizedAgentId,
      normalizeModel(model),
    );
  }

  get provider(): string {
    return this.props.provider;
  }

  get agentId(): string {
    return this.props.agentId;
  }

  get model(): string | null {
    return this.props.model;
  }

  override toString(): string {
    return `${this.props.provider}:${this.props.agentId}`;
  }
}

function normalizeModel(model: string | null): string | null {
  if (model === null) return null;

  const normalized = model.trim();

  if (!MODEL_PATTERN.test(normalized)) {
    throw new DomainValidationError(
      'AGENT_MODEL_INVALID',
      'Agent model is invalid',
      { model },
    );
  }

  return normalized;
}
