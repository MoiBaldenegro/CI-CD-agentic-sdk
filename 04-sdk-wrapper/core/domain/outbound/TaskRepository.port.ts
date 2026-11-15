import type { TaskPrimitives } from "../Task.entity.js";

export interface TaskRepository {
  save(task: TaskPrimitives): void;
  getById(id: string): TaskPrimitives | null;
}
