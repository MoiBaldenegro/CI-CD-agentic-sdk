import { isAbsolute, relative, resolve } from 'node:path';

export type AgentAdapterKind = 'opencode-cli' | 'simulated' | 'unavailable';

export interface OpenCodeCliConfig {
  directory: string;
  model?: string;
  systemPrompt?: string;
  timeoutMs: number;
  /** El agente puede usar git/gh con la sesión de `gh` de la máquina. */
  gitAccess: boolean;
}

/** Directorio raíz donde los agentes tienen permitido trabajar (ver AGENTS.md). */
export const AGENT_WORK_ROOT = resolve(process.cwd(), 'work-directory');

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1_000;

export function resolveAgentAdapter(): AgentAdapterKind {
  const fallback =
    process.env.NODE_ENV === 'production' ? 'unavailable' : 'opencode-cli';
  const value = (process.env.AGENT_ADAPTER ?? fallback).trim().toLowerCase();

  if (value === 'simulated' || value === 'unavailable') {
    return value;
  }

  return 'opencode-cli';
}

export function resolveOpenCodeCliConfig(): OpenCodeCliConfig {
  const timeout = Number(process.env.OPENCODE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  return {
    directory: resolveWorkspace(optionalEnv('OPENCODE_WORKSPACE')),
    model: optionalEnv('OPENCODE_MODEL'),
    systemPrompt: optionalEnv('OPENCODE_SYSTEM_PROMPT'),
    timeoutMs:
      Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
    gitAccess: agentGitAccessEnabled(),
  };
}

export function agentGitAccessEnabled(): boolean {
  const value = process.env.AGENT_GIT_ACCESS?.trim().toLowerCase();
  return value === '1' || value === 'true';
}

/**
 * Resuelve el workspace del agente. Vacío => ./work-directory.
 * Rutas relativas se resuelven contra ./work-directory.
 * Cualquier ruta fuera de ./work-directory se rechaza.
 */
export function resolveWorkspace(value: string | undefined): string {
  const directory =
    value === undefined ? AGENT_WORK_ROOT : resolve(AGENT_WORK_ROOT, value);

  if (!isInside(AGENT_WORK_ROOT, directory)) {
    throw new Error(
      `OPENCODE_WORKSPACE="${value}" está fuera de ${AGENT_WORK_ROOT}. ` +
        'Los agentes solo pueden trabajar dentro de ./work-directory.',
    );
  }

  return directory;
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value !== undefined && value.length > 0 ? value : undefined;
}
