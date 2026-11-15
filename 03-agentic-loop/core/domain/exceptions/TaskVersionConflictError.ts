import { DomainException } from "../../../shared/DomainException.js";

export class TaskVersionConflictError extends DomainException {
  readonly statusCode = 409;
  readonly taskId: string;
  readonly expectedVersion: number;
  readonly actualVersion: number;

  constructor(taskId: string, expectedVersion: number, actualVersion: number) {
    super(
      "TASK_VERSION_CONFLICT",
      `Task ${taskId} version conflict: expected ${expectedVersion}, actual ${actualVersion}`,
      { taskId, expectedVersion, actualVersion },
    );
    this.taskId = taskId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}
