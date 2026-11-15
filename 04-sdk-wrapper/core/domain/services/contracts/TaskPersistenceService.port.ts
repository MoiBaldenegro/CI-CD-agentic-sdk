import type { TaskPrimitives } from "../../Task.entity.js";

export interface TaskPersistenceServicePort {
  save(task: TaskPrimitives): void;
  getById(id: string): TaskPrimitives | null;
}
