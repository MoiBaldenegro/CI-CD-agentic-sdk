import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  Agent,
  AgentApplicationService,
  TaskApplicationService,
  TaskStatus,
  parseTaskAgentOutcome,
  type TaskAgentOutcome,
  type TaskPrimitives,
} from 'lib/factory';
import { TASK_QUEUE_NAME, type TaskQueueJobData } from 'lib/queue';
import {
  GhCliRepositoryWorkspace,
  type PreparedRepository,
  type PublishResult,
} from '../github/gh-cli-repository-workspace';
import { agentGitAccessEnabled } from '../../../../../global/agent.config';
import { buildTaskExecutionPrompt } from './task-execution.prompt';

const SKIPPABLE_STATUSES = new Set([
  'IN_REVIEW',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

@Processor(TASK_QUEUE_NAME, { concurrency: 1 })
export class TaskProcessor extends WorkerHost {
  private readonly logger = new Logger(TaskProcessor.name);

  constructor(
    private readonly taskApplicationService: TaskApplicationService,
    private readonly agentApplicationService: AgentApplicationService,
    private readonly repositoryWorkspace: GhCliRepositoryWorkspace,
  ) {
    super();
  }

  async process(job: Job<TaskQueueJobData>): Promise<void> {
    const taskId = job.data.taskId;

    this.logger.log(`Job ${job.id} iniciado taskId=${taskId}`);

    const current = await this.taskApplicationService.getTask(taskId);

    if (current === null) {
      throw new Error(`Task ${taskId} was not found`);
    }

    if (SKIPPABLE_STATUSES.has(current.status)) {
      this.logger.warn(
        `Job ${job.id} omitido: tarea ${taskId} está en ${current.status}`,
      );
      return;
    }

    let task = await this.moveToInProgress(current);

    try {
      const workspace = await this.prepareRepository(task);
      const outcome = await this.executeTask(task, workspace);
      const published =
        workspace !== null && outcome.status !== 'BLOCKED'
          ? await this.repositoryWorkspace.publish(
              workspace.directory,
              `${task.title}\n\nFactory task: ${task.id}`,
            )
          : null;

      task = await this.applyOutcome(
        task.id,
        withRepositoryInfo(outcome, workspace, published),
      );

      this.logger.log(
        `Job ${job.id} terminado taskId=${taskId} outcome=${outcome.status} status=${task.status}`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`Job ${job.id} falló taskId=${taskId}: ${message}`);
      await this.safeFail(taskId, message);

      throw error;
    }
  }

  private async moveToInProgress(
    task: TaskPrimitives,
  ): Promise<TaskPrimitives> {
    let current = task;

    if (current.status === 'PENDING' || current.status === 'BLOCKED') {
      current = await this.taskApplicationService.changeTaskStatus(
        current.id,
        TaskStatus.queued(),
        { blockReason: null },
      );
    }

    if (current.status === 'QUEUED') {
      current = await this.taskApplicationService.changeTaskStatus(
        current.id,
        TaskStatus.inProgress(),
      );
    }

    return current;
  }

  private async prepareRepository(
    task: TaskPrimitives,
  ): Promise<PreparedRepository | null> {
    if (!githubEnabled()) {
      return null;
    }

    const prepared = await this.repositoryWorkspace.prepare(task.repository, {
      description: task.title,
      visibility: task.metadata.visibility === 'public' ? 'public' : 'private',
    });

    this.logger.log(
      `Repo listo ${prepared.url} (created=${prepared.created}) en ${prepared.directory}`,
    );

    return prepared;
  }

  private async executeTask(
    task: TaskPrimitives,
    workspace: PreparedRepository | null,
  ): Promise<TaskAgentOutcome> {
    const agent = Agent.create({
      provider: task.assignee?.provider ?? 'opencode',
      agentId: task.assignee?.agentId ?? 'builder-01',
      model: task.assignee?.model ?? null,
    });

    this.logger.log(
      `Ejecutando tarea id=${task.id} con agente ${agent.provider}:${agent.agentId}`,
    );

    const response = await this.agentApplicationService.sendPrompt(agent, {
      text: buildTaskExecutionPrompt(
        task,
        workspace?.url,
        agentGitAccessEnabled(),
      ),
      workingDirectory: workspace?.directory,
    });

    return parseTaskAgentOutcome(response.text);
  }

  private async applyOutcome(
    taskId: string,
    outcome: TaskAgentOutcome,
  ): Promise<TaskPrimitives> {
    if (outcome.status === 'BLOCKED') {
      return this.taskApplicationService.changeTaskStatus(
        taskId,
        TaskStatus.blocked(),
        {
          blockReason:
            outcome.reason ?? 'OpenCode solicitó intervención humana',
          completionSummary: outcome.summary,
        },
      );
    }

    if (outcome.status === 'IN_REVIEW') {
      return this.taskApplicationService.changeTaskStatus(
        taskId,
        TaskStatus.inReview(),
        {
          completionSummary: outcome.summary,
        },
      );
    }

    return this.taskApplicationService.changeTaskStatus(
      taskId,
      TaskStatus.completed(),
      {
        completionSummary: outcome.summary,
      },
    );
  }

  private async safeFail(taskId: string, reason: string): Promise<void> {
    try {
      const task = await this.taskApplicationService.getTask(taskId);

      if (task === null || SKIPPABLE_STATUSES.has(task.status)) {
        return;
      }

      await this.taskApplicationService.changeTaskStatus(
        taskId,
        TaskStatus.failed(),
        { failureReason: reason },
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `No se pudo marcar como FAILED la tarea ${taskId}: ${message}`,
      );
    }
  }
}

function githubEnabled(): boolean {
  const value = process.env.GITHUB_ENABLED?.trim().toLowerCase();
  return value === '1' || value === 'true';
}

function withRepositoryInfo(
  outcome: TaskAgentOutcome,
  workspace: PreparedRepository | null,
  published: PublishResult | null,
): TaskAgentOutcome {
  if (workspace === null) {
    return outcome;
  }

  const lines = [`Repositorio: ${workspace.url}`];
  if (published?.pushed) {
    lines.push(`Rama: ${published.branch}`, `Commit: ${published.commitSha}`);
  } else if (published !== null) {
    lines.push('Sin cambios para publicar.');
  }

  return {
    ...outcome,
    summary: `${outcome.summary}\n\n${lines.join('\n')}`,
  };
}
