import { Logger } from '@nestjs/common';
import type { TaskPrimitives } from '../../domain/Task.entity.js';
import type { TaskPersistenceServicePort } from '../../domain/services/contracts/TaskPersistenceService.port.js';

export class ListTasksUseCase {
  private readonly logger = new Logger(ListTasksUseCase.name);

  constructor(
    private readonly taskPersistenceService: TaskPersistenceServicePort,
  ) {}

  async execute(): Promise<TaskPrimitives[]> {
    this.logger.log('Listando tareas');

    const tasks = await this.taskPersistenceService.findAll();

    this.logger.log(`Tareas listadas total=${tasks.length}`);

    return tasks;
  }
}
