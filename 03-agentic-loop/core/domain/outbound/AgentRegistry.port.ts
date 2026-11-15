import type { AgentRef } from "../value-objects/AgentRef.vo.js";

export interface AgentDescriptor {
  readonly agent: AgentRef;
  readonly label: string;
  readonly capabilities: readonly string[];
  readonly metadata: Readonly<Record<string, string>>;
}

export interface AgentRequirements {
  readonly taskId: string;
  readonly capabilities?: readonly string[];
  readonly preferredProvider?: string;
  readonly excludedProviders?: readonly string[];
}

export interface AgentRegistry {
  list(): Promise<readonly AgentDescriptor[]>;
  resolve(requirements: AgentRequirements): Promise<AgentDescriptor | null>;
}
