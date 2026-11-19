import type { TaskPrimitives } from '../Task.entity.js';
import type { TaskRepository } from '../outbound/TaskRepository.port.js';
import type { TaskPersistenceServicePort } from './contracts/TaskPersistenceService.port.js';

export class TaskPersistenceService implements TaskPersistenceServicePort {
  constructor(private readonly repository: TaskRepository) {}

  save(task: TaskPrimitives): Promise<void> {
    return this.repository.save(task);
  }

  getById(id: string): Promise<TaskPrimitives | null> {
    return this.repository.getById(id);
  }

  findAll(): Promise<TaskPrimitives[]> {
    return this.repository.findAll();
  }
}
