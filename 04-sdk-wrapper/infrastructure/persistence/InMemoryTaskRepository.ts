import type { TaskPrimitives } from "../../core/domain/Task.entity.js";
import type { TaskRepository } from "../../core/domain/outbound/TaskRepository.port.js";

export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, TaskPrimitives>();

  save(task: TaskPrimitives): void {
    this.tasks.set(task.id, cloneTask(task));
  }

  getById(id: string): TaskPrimitives | null {
    const task = this.tasks.get(id);
    return task === undefined ? null : cloneTask(task);
  }
}

function cloneTask(task: TaskPrimitives): TaskPrimitives {
  return {
    ...task,
    sourceRef: task.sourceRef === null ? null : { ...task.sourceRef },
    repository: { ...task.repository },
    assignee: task.assignee === null ? null : { ...task.assignee },
    acceptanceCriteria: [...task.acceptanceCriteria],
    metadata: { ...task.metadata },
  };
}
