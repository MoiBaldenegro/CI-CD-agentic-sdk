import type { Task } from "../entities/Task.entity.js";
import { TASK_STATUS } from "../value-objects/TaskStatus.vo.js";

export class TaskPrioritizationService {
  prioritize(tasks: readonly Task[]): readonly Task[] {
    return [...tasks].sort((left, right) => this.compare(left, right));
  }

  selectNext(tasks: readonly Task[]): Task | null {
    const next = this.prioritize(tasks).find(
      (task) =>
        task.status.value === TASK_STATUS.PENDING || task.status.value === TASK_STATUS.QUEUED,
    );

    return next ?? null;
  }

  isQueueable(task: Task): boolean {
    return (
      task.status.value === TASK_STATUS.PENDING || task.status.value === TASK_STATUS.QUEUED
    );
  }

  private compare(left: Task, right: Task): number {
    if (!left.priority.equals(right.priority)) {
      return left.priority.isHigherThan(right.priority) ? -1 : 1;
    }

    const createdDifference = left.createdAt.getTime() - right.createdAt.getTime();

    if (createdDifference !== 0) {
      return createdDifference;
    }

    return left.id.value.localeCompare(right.id.value);
  }
}
