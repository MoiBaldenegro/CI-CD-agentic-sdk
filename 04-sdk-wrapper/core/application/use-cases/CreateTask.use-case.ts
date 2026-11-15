import type { CreateTaskProps, TaskPrimitives } from "../../domain/Task.entity.js";
import type { TaskCreationServicePort } from "../../domain/services/contracts/TaskCreationService.port.js";
import type { TaskPersistenceServicePort } from "../../domain/services/contracts/TaskPersistenceService.port.js";

export class CreateTaskUseCase {
  constructor(
    private readonly taskCreationService: TaskCreationServicePort,
    private readonly taskPersistenceService: TaskPersistenceServicePort,
  ) {}

  execute(props: CreateTaskProps): TaskPrimitives {
    const task = this.taskCreationService.create(props);
    this.taskPersistenceService.save(task);
    return task;
  }
}
