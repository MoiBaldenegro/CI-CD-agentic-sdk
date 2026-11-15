import { DomainException } from "../../../shared/DomainException.js";

export class TaskNotFoundError extends DomainException {
  readonly statusCode = 404;
  readonly taskId: string;

  constructor(taskId: string) {
    super("TASK_NOT_FOUND", `Task ${taskId} was not found`, { taskId });
    this.taskId = taskId;
  }
}
