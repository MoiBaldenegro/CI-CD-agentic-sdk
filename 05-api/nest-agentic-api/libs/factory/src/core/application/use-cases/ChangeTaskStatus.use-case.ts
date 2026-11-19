import { Logger } from '@nestjs/common';
import {
  Task,
  type TaskPrimitives,
  type TaskTransitionDetails,
} from '../../domain/Task.entity.js';
import { DomainValidationError } from '../../domain/exceptions/DomainValidationError.js';
import type { TaskPersistenceServicePort } from '../../domain/services/contracts/TaskPersistenceService.port.js';
import type { TaskStatus } from '../../domain/value-objects/task/TaskStatus.vo.js';

export class ChangeTaskStatusUseCase {
  private readonly logger = new Logger(ChangeTaskStatusUseCase.name);

  constructor(
    private readonly taskPersistenceService: TaskPersistenceServicePort,
  ) {}

  async execute(
    taskId: string,
    nextStatus: TaskStatus,
    details: TaskTransitionDetails = {},
  ): Promise<TaskPrimitives> {
    const current = await this.taskPersistenceService.getById(taskId);

    if (current === null) {
      throw new DomainValidationError(
        'TASK_NOT_FOUND',
        `Task ${taskId} was not found`,
        { taskId },
      );
    }

    const task = Task.fromPrimitives(current);
    const updated = task.transitionTo(nextStatus, details);

    await this.taskPersistenceService.save(updated);

    this.logger.log(`Tarea ${taskId}: ${current.status} -> ${updated.status}`);

    return updated;
  }
}
