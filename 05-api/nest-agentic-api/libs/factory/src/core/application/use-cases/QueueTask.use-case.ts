import { Logger } from '@nestjs/common';
import { Task, type TaskPrimitives } from '../../domain/Task.entity.js';
import { DomainValidationError } from '../../domain/exceptions/DomainValidationError.js';
import type { TaskQueuePort } from '../../domain/outbound/TaskQueue.port.js';
import type { TaskPersistenceServicePort } from '../../domain/services/contracts/TaskPersistenceService.port.js';
import { TaskStatus } from '../../domain/value-objects/task/TaskStatus.vo.js';

export interface QueueTaskResult {
  task: TaskPrimitives;
  jobId: string;
}

const QUEUEABLE_STATUSES = new Set(['PENDING', 'BLOCKED']);

export class QueueTaskUseCase {
  private readonly logger = new Logger(QueueTaskUseCase.name);

  constructor(
    private readonly taskPersistenceService: TaskPersistenceServicePort,
    private readonly taskQueue: TaskQueuePort,
  ) {}

  async execute(taskId: string): Promise<QueueTaskResult> {
    const current = await this.taskPersistenceService.getById(taskId);

    if (current === null) {
      throw new DomainValidationError(
        'TASK_NOT_FOUND',
        `Task ${taskId} was not found`,
        { taskId },
      );
    }

    if (!QUEUEABLE_STATUSES.has(current.status)) {
      throw new DomainValidationError(
        'TASK_NOT_QUEUEABLE',
        `Task ${taskId} cannot be queued from status ${current.status}`,
        { taskId, status: current.status },
      );
    }

    this.logger.log(`Encolando tarea id=${taskId} status=${current.status}`);

    const queuedJob = await this.taskQueue.enqueue(taskId);

    const latest = await this.taskPersistenceService.getById(taskId);
    const currentTask = latest ?? current;

    if (QUEUEABLE_STATUSES.has(currentTask.status)) {
      const queued = Task.fromPrimitives(currentTask).transitionTo(
        TaskStatus.queued(),
        { blockReason: null },
      );

      await this.taskPersistenceService.save(queued);

      this.logger.log(
        `Tarea encolada id=${taskId} jobId=${queuedJob.jobId} status=${queued.status}`,
      );

      return { task: queued, jobId: queuedJob.jobId };
    }

    this.logger.log(
      `Tarea ya tomada por el worker id=${taskId} status=${currentTask.status} jobId=${queuedJob.jobId}`,
    );

    return { task: currentTask, jobId: queuedJob.jobId };
  }
}
