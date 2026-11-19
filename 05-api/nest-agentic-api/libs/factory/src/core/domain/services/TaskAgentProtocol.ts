export type TaskAgentOutcomeStatus = 'COMPLETED' | 'IN_REVIEW' | 'BLOCKED';

export interface TaskAgentOutcome {
  status: TaskAgentOutcomeStatus;
  reason: string | null;
  summary: string;
}

const MARKER_PATTERN =
  /\[\[FACTORY_STATUS:(COMPLETED|IN_REVIEW|BLOCKED)(?::([^\]]*))?\]\]/gi;

export const TASK_AGENT_STATUS_INSTRUCTIONS = [
  'Al terminar, agrega como última línea uno de estos marcadores:',
  '[[FACTORY_STATUS:COMPLETED]] si terminaste correctamente.',
  '[[FACTORY_STATUS:IN_REVIEW]] si un humano debe validar el resultado.',
  '[[FACTORY_STATUS:BLOCKED:motivo]] si necesitas una decisión humana, credenciales, acceso o una acción externa.',
].join('\n');

export function parseTaskAgentOutcome(text: string): TaskAgentOutcome {
  const matches = [...text.matchAll(MARKER_PATTERN)];
  const last = matches.at(-1);
  const status = normalizeStatus(last?.[1]);
  const reason = last?.[2]?.trim() || null;
  const summary = text.replace(MARKER_PATTERN, '').trim().slice(0, 4_000);

  return {
    status,
    reason,
    summary: summary.length > 0 ? summary : 'OpenCode no devolvió un resumen.',
  };
}

function normalizeStatus(value: string | undefined): TaskAgentOutcomeStatus {
  const normalized = value?.trim().toUpperCase();

  if (normalized === 'IN_REVIEW' || normalized === 'BLOCKED') {
    return normalized;
  }

  return 'COMPLETED';
}
