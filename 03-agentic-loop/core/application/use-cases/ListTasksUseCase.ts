import type { TaskPrimitives } from "../../domain/entities/Task.entity.js";
import type { TaskRepository } from "../../domain/outbound/TaskRepository.port.js";

export class ListTasksUseCase {
  private readonly repository: TaskRepository;

  constructor(repository: TaskRepository) {
    this.repository = repository;
  }

  async execute(limit = 100): Promise<readonly TaskPrimitives[]> {
    const tasks = await this.repository.findAll(limit);
    return tasks.map((task) => task.toPrimitives());
  }
}
