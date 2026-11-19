import type { TaskPrimitives } from '../../Task.entity.js';

export interface TaskPersistenceServicePort {
  save(task: TaskPrimitives): Promise<void>;
  getById(id: string): Promise<TaskPrimitives | null>;
  findAll(): Promise<TaskPrimitives[]>;
}
