import type { TaskPrimitives } from "../../domain/entities/Task.entity.js";
import { TaskId } from "../../domain/value-objects/TaskId.vo.js";
import type { TaskPersistenceService } from "../services/TaskPersistenceService.js";

export class GetTaskUseCase {
  private readonly persistence: TaskPersistenceService;

  constructor(persistence: TaskPersistenceService) {
    this.persistence = persistence;
  }

  async execute(taskId: string): Promise<TaskPrimitives> {
    const task = await this.persistence.getById(TaskId.from(taskId));
    return task.toPrimitives();
  }
}
