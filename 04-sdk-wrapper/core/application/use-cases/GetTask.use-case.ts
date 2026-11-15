import type { TaskPrimitives } from "../../domain/Task.entity.js";
import type { TaskPersistenceServicePort } from "../../domain/services/contracts/TaskPersistenceService.port.js";

export class GetTaskUseCase {
  constructor(private readonly taskPersistenceService: TaskPersistenceServicePort) {}

  execute(id: string): TaskPrimitives | null {
    return this.taskPersistenceService.getById(id);
  }
}
