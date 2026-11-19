import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { Agent, AgentApplicationService } from 'lib/factory';
import { ghExecutable } from '../infrastructure/github/gh-git-env';

export interface IntakeMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface TaskDraft {
  readonly title: string;
  readonly description: string;
  readonly owner: string;
  readonly repositoryName: string;
  readonly visibility: 'private' | 'public';
  readonly acceptanceCriteria: string[];
}

export type IntakeResult =
  | { readonly status: 'questions'; readonly questions: string[] }
  | { readonly status: 'ready'; readonly task: TaskDraft };

const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 6_000;

const INTAKE_INSTRUCTIONS = `Eres el asistente de admisión del Agentic Factory.
Conviertes lo que pide el usuario en una ficha de tarea que después ejecutará un agente de programación sobre un repositorio de GitHub. Tú NO ejecutas nada.

Reglas:
- Si falta información IMPORTANTE para hacer un buen trabajo (qué construir, alcance, tecnología cuando importa, contenido clave), haz entre 1 y 3 preguntas concretas y breves.
- No preguntes lo que tenga un valor por defecto razonable. Si el usuario dice que decidas tú, decide.
- No repitas preguntas ya respondidas.
- Cuando tengas suficiente, arma la ficha. La descripción debe ser completa y autocontenida: el agente que la ejecute no verá esta conversación.

Responde SOLO con JSON válido, sin texto adicional ni bloques de código, con UNA de estas dos formas:
{"status":"questions","questions":["pregunta 1","pregunta 2"]}
{"status":"ready","task":{"title":"máx 120 caracteres","description":"instrucciones completas para el agente","repositoryName":"nombre-en-kebab-case","visibility":"private","acceptanceCriteria":["criterio verificable 1","criterio 2"]}}

visibility es "private" salvo que el usuario pida público. repositoryName solo puede tener minúsculas, números y guiones.`;

@Injectable()
export class TaskIntakeService {
  private readonly logger = new Logger(TaskIntakeService.name);
  private ownerCache: string | null = null;

  constructor(
    private readonly agentApplicationService: AgentApplicationService,
  ) {}

  async next(messages: IntakeMessage[]): Promise<IntakeResult> {
    const conversation = validateMessages(messages);

    this.logger.log(`Admisión: ${conversation.length} mensajes`);

    const response = await this.agentApplicationService.sendPrompt(
      Agent.create({ provider: 'opencode', agentId: 'intake', model: null }),
      { text: buildPrompt(conversation), toolsEnabled: false },
    );

    const parsed = parseIntakeResponse(response.text);

    if (parsed.status === 'questions') {
      return parsed;
    }

    return {
      status: 'ready',
      task: { ...parsed.task, owner: await this.defaultOwner() },
    };
  }

  /** GITHUB_OWNER o, si no está, el usuario de la sesión de `gh`. */
  async defaultOwner(): Promise<string> {
    const configured = process.env.GITHUB_OWNER?.trim();
    if (configured) {
      return configured;
    }

    if (this.ownerCache === null) {
      this.ownerCache = await new Promise<string>((resolve) => {
        execFile(
          ghExecutable(),
          ['api', 'user', '-q', '.login'],
          { windowsHide: true, timeout: 30_000 },
          (error, stdout) => resolve(error ? '' : stdout.trim()),
        );
      });
    }

    return this.ownerCache;
  }
}

function validateMessages(messages: unknown): IntakeMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new BadRequestException('messages es requerido');
  }

  if (messages.length > MAX_MESSAGES) {
    throw new BadRequestException(
      `La conversación es demasiado larga (máx. ${MAX_MESSAGES} mensajes)`,
    );
  }

  return messages.map((message: unknown) => {
    const candidate = message as Partial<IntakeMessage> | null;
    if (
      candidate === null ||
      (candidate.role !== 'user' && candidate.role !== 'assistant') ||
      typeof candidate.content !== 'string' ||
      candidate.content.trim().length === 0
    ) {
      throw new BadRequestException('Mensaje inválido en la conversación');
    }

    return {
      role: candidate.role,
      content: candidate.content.trim().slice(0, MAX_MESSAGE_CHARS),
    };
  });
}

function buildPrompt(conversation: IntakeMessage[]): string {
  const transcript = conversation
    .map(
      (message) =>
        `${message.role === 'user' ? 'USUARIO' : 'ASISTENTE'}: ${message.content}`,
    )
    .join('\n\n');

  return `${INTAKE_INSTRUCTIONS}\n\nConversación hasta ahora:\n\n${transcript}\n\nTu respuesta JSON:`;
}

export function parseIntakeResponse(
  text: string,
):
  | { status: 'questions'; questions: string[] }
  | { status: 'ready'; task: Omit<TaskDraft, 'owner'> } {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end <= start) {
    throw new Error('El asistente no devolvió JSON');
  }

  const data = JSON.parse(text.slice(start, end + 1)) as Record<
    string,
    unknown
  >;

  if (data.status === 'questions') {
    const questions = asStringList(data.questions).slice(0, 5);
    if (questions.length === 0) {
      throw new Error('El asistente devolvió preguntas vacías');
    }
    return { status: 'questions', questions };
  }

  if (data.status === 'ready' && typeof data.task === 'object' && data.task) {
    const task = data.task as Record<string, unknown>;
    const title = asText(task.title).slice(0, 200);
    const description = asText(task.description).slice(0, 20_000);

    if (title.length === 0 || description.length === 0) {
      throw new Error('La ficha del asistente no trae título o descripción');
    }

    return {
      status: 'ready',
      task: {
        title,
        description,
        repositoryName: toRepositoryName(asText(task.repositoryName) || title),
        visibility: task.visibility === 'public' ? 'public' : 'private',
        acceptanceCriteria: asStringList(task.acceptanceCriteria).slice(0, 20),
      },
    };
  }

  throw new Error('Respuesta del asistente con formato desconocido');
}

export function toRepositoryName(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/g, '');

  return slug.length > 0 ? slug : 'proyecto-factory';
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(asText).filter((item) => item.length > 0)
    : [];
}
