import type { AgentRef } from "../value-objects/AgentRef.vo.js";

export const AGENT_OUTCOME = {
  SUCCESS: "SUCCESS",
  FAILURE: "FAILURE",
  BLOCKED: "BLOCKED",
} as const;

export type AgentOutcomeValue = (typeof AGENT_OUTCOME)[keyof typeof AGENT_OUTCOME];

export const AGENT_ARTIFACT_KIND = {
  PATCH: "PATCH",
  COMMIT: "COMMIT",
  PULL_REQUEST: "PULL_REQUEST",
  FILE: "FILE",
  LOG: "LOG",
  OTHER: "OTHER",
} as const;

export type AgentArtifactKindValue = (typeof AGENT_ARTIFACT_KIND)[keyof typeof AGENT_ARTIFACT_KIND];

export interface AgentArtifact {
  readonly kind: AgentArtifactKindValue;
  readonly uri: string;
  readonly description: string | null;
}

export interface AgentUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly costUsd: number | null;
}

export interface AgentExecutionContext {
  readonly repository: {
    readonly owner: string;
    readonly name: string;
    readonly baseBranch: string;
  };
  readonly acceptanceCriteria: readonly string[];
  readonly metadata: Readonly<Record<string, string>>;
}

export interface AgentExecutionRequest {
  readonly taskId: string;
  readonly agent: AgentRef;
  readonly instructions: string;
  readonly context: AgentExecutionContext;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export interface AgentExecutionResult {
  readonly outcome: AgentOutcomeValue;
  readonly summary: string;
  readonly artifacts: readonly AgentArtifact[];
  readonly usage: AgentUsage | null;
  readonly raw: unknown;
}

export interface AgentGateway {
  execute(request: AgentExecutionRequest): Promise<AgentExecutionResult>;
}
