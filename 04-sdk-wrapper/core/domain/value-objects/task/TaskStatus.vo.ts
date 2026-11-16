import { DomainValidationError } from "../../exceptions/DomainValidationError.js";
import { InvalidStateTransitionError } from "../../exceptions/InvalidStateTransitionError.js";
import { ValueObject } from "../ValueObject.js";

export const TASK_STATUS = {
  PENDING: "PENDING",
  QUEUED: "QUEUED",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  IN_REVIEW: "IN_REVIEW",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;

export type TaskStatusValue = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

const TRANSITIONS: Record<TaskStatusValue, readonly TaskStatusValue[]> = {
  PENDING: ["QUEUED", "CANCELLED"],
  QUEUED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["BLOCKED", "IN_REVIEW", "COMPLETED", "FAILED", "CANCELLED"],
  BLOCKED: ["QUEUED", "IN_PROGRESS", "FAILED", "CANCELLED"],
  IN_REVIEW: ["IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

const TERMINAL_STATUSES: readonly TaskStatusValue[] = ["COMPLETED", "FAILED", "CANCELLED"];

interface TaskStatusProps extends Record<string, unknown> {
  readonly value: TaskStatusValue;
}

export class TaskStatus extends ValueObject<TaskStatusProps> {
  private constructor(value: TaskStatusValue) {
    super({ value });
  }

  static from(value: string): TaskStatus {
    const normalized = value.trim().toUpperCase();

    if (!isTaskStatusValue(normalized)) {
      throw new DomainValidationError(
        "TASK_STATUS_INVALID",
        `Task status must be one of: ${Object.values(TASK_STATUS).join(", ")}`,
        { value },
      );
    }

    return new TaskStatus(normalized);
  }

  static pending(): TaskStatus {
    return new TaskStatus(TASK_STATUS.PENDING);
  }

  static queued(): TaskStatus {
    return new TaskStatus(TASK_STATUS.QUEUED);
  }

  static inProgress(): TaskStatus {
    return new TaskStatus(TASK_STATUS.IN_PROGRESS);
  }

  static blocked(): TaskStatus {
    return new TaskStatus(TASK_STATUS.BLOCKED);
  }

  static inReview(): TaskStatus {
    return new TaskStatus(TASK_STATUS.IN_REVIEW);
  }

  static completed(): TaskStatus {
    return new TaskStatus(TASK_STATUS.COMPLETED);
  }

  static failed(): TaskStatus {
    return new TaskStatus(TASK_STATUS.FAILED);
  }

  static cancelled(): TaskStatus {
    return new TaskStatus(TASK_STATUS.CANCELLED);
  }

  get value(): TaskStatusValue {
    return this.props.value;
  }

  isTerminal(): boolean {
    return TERMINAL_STATUSES.includes(this.props.value);
  }

  canTransitionTo(next: TaskStatus): boolean {
    return TRANSITIONS[this.props.value].includes(next.props.value);
  }

  assertTransitionTo(next: TaskStatus): void {
    if (!this.canTransitionTo(next)) {
      throw new InvalidStateTransitionError(this.props.value, next.props.value);
    }
  }

  override toString(): string {
    return this.props.value;
  }
}

function isTaskStatusValue(value: string): value is TaskStatusValue {
  return Object.values(TASK_STATUS).some((status) => status === value);
}
