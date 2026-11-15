import type {
  AgentDescriptor,
  AgentRegistry,
  AgentRequirements,
} from "../../core/domain/outbound/AgentRegistry.port.js";

export class StaticAgentRegistry implements AgentRegistry {
  private readonly agents: readonly AgentDescriptor[];

  constructor(agents: readonly AgentDescriptor[]) {
    this.agents = agents;
  }

  async list(): Promise<readonly AgentDescriptor[]> {
    return this.agents;
  }

  async resolve(requirements: AgentRequirements): Promise<AgentDescriptor | null> {
    const excluded = new Set(requirements.excludedProviders ?? []);
    const capabilities = requirements.capabilities ?? [];

    const candidates = this.agents.filter(
      (descriptor) =>
        !excluded.has(descriptor.agent.provider) &&
        capabilities.every((capability) => descriptor.capabilities.includes(capability)),
    );

    if (requirements.preferredProvider !== undefined) {
      const preferred = candidates.find(
        (descriptor) => descriptor.agent.provider === requirements.preferredProvider,
      );

      if (preferred !== undefined) return preferred;
    }

    return candidates[0] ?? null;
  }
}
