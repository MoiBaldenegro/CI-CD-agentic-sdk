import type { TaskPrimitives } from '../Task.entity.js';

export interface TaskRepository {
  save(task: TaskPrimitives): Promise<void>;
  getById(id: string): Promise<TaskPrimitives | null>;
  findAll(): Promise<TaskPrimitives[]>;
}
