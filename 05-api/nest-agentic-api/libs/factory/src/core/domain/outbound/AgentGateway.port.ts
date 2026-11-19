import type { AgentPrimitives } from '../Agent.entity.js';

export interface AgentPrompt {
  readonly text: string;
  /** Carpeta donde debe trabajar el agente (p. ej. el repo clonado). */
  readonly workingDirectory?: string;
}

export interface AgentResponse {
  readonly text: string;
  readonly sessionId: string | null;
}

export interface AgentGateway {
  sendPrompt(
    agent: AgentPrimitives,
    prompt: AgentPrompt,
  ): Promise<AgentResponse>;
}
