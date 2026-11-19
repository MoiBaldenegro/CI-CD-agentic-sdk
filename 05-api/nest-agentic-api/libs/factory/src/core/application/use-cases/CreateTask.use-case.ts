import { Logger } from '@nestjs/common';
import type {
  CreateTaskProps,
  TaskPrimitives,
} from '../../domain/Task.entity.js';
import type { TaskCreationServicePort } from '../../domain/services/contracts/TaskCreationService.port.js';
import type { TaskPersistenceServicePort } from '../../domain/services/contracts/TaskPersistenceService.port.js';

export class CreateTaskUseCase {
  private readonly logger = new Logger(CreateTaskUseCase.name);

  constructor(
    private readonly taskCreationService: TaskCreationServicePort,
    private readonly taskPersistenceService: TaskPersistenceServicePort,
  ) {}

  async execute(props: CreateTaskProps): Promise<TaskPrimitives> {
    this.logger.log(
      `Creando tarea title="${props.title.value}" source=${props.source.value}`,
    );

    const task = this.taskCreationService.create(props);
    this.logger.log(`Tarea creada id=${task.id} status=${task.status}`);

    await this.taskPersistenceService.save(task);
    this.logger.log(`Tarea persistida id=${task.id}`);

    return task;
  }
}
