import type { Task } from "../entities/Task.entity.js";
import type { TaskId } from "../value-objects/TaskId.vo.js";
import type { TaskStatus } from "../value-objects/TaskStatus.vo.js";

export interface TaskRepository {
  save(task: Task): Promise<void>;
  findById(id: TaskId): Promise<Task | null>;
  findByStatus(status: TaskStatus, limit?: number): Promise<readonly Task[]>;
  findNext(limit?: number): Promise<readonly Task[]>;
  delete(id: TaskId): Promise<void>;
}
