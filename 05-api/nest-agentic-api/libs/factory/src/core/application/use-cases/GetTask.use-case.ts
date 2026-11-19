import { Logger } from '@nestjs/common';
import type { TaskPrimitives } from '../../domain/Task.entity.js';
import type { TaskPersistenceServicePort } from '../../domain/services/contracts/TaskPersistenceService.port.js';

export class GetTaskUseCase {
  private readonly logger = new Logger(GetTaskUseCase.name);

  constructor(
    private readonly taskPersistenceService: TaskPersistenceServicePort,
  ) {}

  async execute(id: string): Promise<TaskPrimitives | null> {
    this.logger.log(`Buscando tarea id=${id}`);

    const task = await this.taskPersistenceService.getById(id);

    this.logger.log(
      task === null
        ? `Tarea no encontrada id=${id}`
        : `Tarea encontrada id=${id} status=${task.status}`,
    );

    return task;
  }
}
