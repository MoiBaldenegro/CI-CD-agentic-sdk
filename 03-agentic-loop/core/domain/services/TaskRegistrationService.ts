import type { Task } from "../entities/Task.entity.js";
import { TaskAlreadyExistsError } from "../exceptions/TaskAlreadyExistsError.js";
import type { TaskRepository } from "../outbound/TaskRepository.port.js";

export class TaskRegistrationService {
  private readonly repository: TaskRepository;

  constructor(repository: TaskRepository) {
    this.repository = repository;
  }

  async ensureNotDuplicated(task: Task): Promise<void> {
    if (task.sourceRef === null) return;

    const existing = await this.repository.findBySourceRef(
      task.source.value,
      task.sourceRef.externalId,
    );

    if (existing !== null && !existing.id.equals(task.id)) {
      throw new TaskAlreadyExistsError(task.source.value, task.sourceRef.externalId);
    }
  }
}
