import { DomainException } from "../../../shared/DomainException.js";

export class TaskTerminalStateError extends DomainException {
  readonly statusCode = 409;
  readonly taskId: string;
  readonly status: string;

  constructor(taskId: string, status: string) {
    super("TASK_TERMINAL_STATE", `Task ${taskId} is in terminal state ${status}`, {
      taskId,
      status,
    });
    this.taskId = taskId;
    this.status = status;
  }
}
