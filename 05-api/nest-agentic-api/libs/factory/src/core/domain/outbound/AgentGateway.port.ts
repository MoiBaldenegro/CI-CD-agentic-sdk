import type { AgentPrimitives } from '../Agent.entity.js';

export interface AgentPrompt {
  readonly text: string;
  /** Carpeta donde debe trabajar el agente (p. ej. el repo clonado). */
  readonly workingDirectory?: string;
  /**
   * false = modo conversación: el agente solo responde texto, sin
   * herramientas (no lee/escribe archivos ni ejecuta comandos).
   * Por defecto true.
   */
  readonly toolsEnabled?: boolean;
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
