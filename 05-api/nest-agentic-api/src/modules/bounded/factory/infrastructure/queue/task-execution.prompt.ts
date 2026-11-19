import {
  TASK_AGENT_STATUS_INSTRUCTIONS,
  type TaskPrimitives,
} from 'lib/factory';

export function buildTaskExecutionPrompt(
  task: TaskPrimitives,
  repositoryUrl?: string,
  gitAccess = false,
): string {
  const acceptanceCriteria =
    task.acceptanceCriteria.length > 0
      ? task.acceptanceCriteria.map((item) => `- ${item}`).join('\n')
      : '- Sin criterios explícitos';

  const metadata =
    Object.keys(task.metadata).length > 0
      ? Object.entries(task.metadata)
          .map(([key, value]) => `- ${key}: ${value}`)
          .join('\n')
      : '- Sin metadata';

  return [
    'Ejecuta la siguiente tarea del Agentic Factory.',
    '',
    `ID: ${task.id}`,
    `Título: ${task.title}`,
    `Descripción: ${task.description}`,
    `Fuente: ${task.source}`,
    `Prioridad: ${task.priority}`,
    `Repositorio: ${task.repository.owner}/${task.repository.name}`,
    `Rama base: ${task.repository.baseBranch}`,
    `Agente asignado: ${
      task.assignee
        ? `${task.assignee.provider}:${task.assignee.agentId}`
        : 'opencode:builder-01'
    }`,
    '',
    'Criterios de aceptación:',
    acceptanceCriteria,
    '',
    'Metadata:',
    metadata,
    '',
    'Trabaja dentro del workspace autorizado y no accedas a rutas externas.',
    '',
    ...(repositoryUrl
      ? [
          `Tu directorio actual es un clon de ${repositoryUrl}.`,
          gitAccess
            ? 'Crea o modifica los archivos directamente en él. Puedes hacer commit y push tú mismo; si dejas cambios pendientes, la fábrica los publica al terminar.'
            : 'Crea o modifica los archivos directamente en él. No ejecutes git ni gh.',
          '',
        ]
      : []),
    TASK_AGENT_STATUS_INSTRUCTIONS,
  ].join('\n');
}
