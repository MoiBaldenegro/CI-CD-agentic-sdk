import { DomainValidationError } from '../../exceptions/DomainValidationError.js';
import { ValueObject } from '../ValueObject.js';

export const TASK_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type TaskPriorityValue =
  (typeof TASK_PRIORITY)[keyof typeof TASK_PRIORITY];

const RANK: Record<TaskPriorityValue, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

interface TaskPriorityProps extends Record<string, unknown> {
  readonly value: TaskPriorityValue;
}

export class TaskPriority extends ValueObject<TaskPriorityProps> {
  private constructor(value: TaskPriorityValue) {
    super({ value });
  }

  static from(value: string): TaskPriority {
    const normalized = value.trim().toUpperCase();

    if (!isTaskPriorityValue(normalized)) {
      throw new DomainValidationError(
        'TASK_PRIORITY_INVALID',
        `Task priority must be one of: ${Object.values(TASK_PRIORITY).join(', ')}`,
        { value },
      );
    }

    return new TaskPriority(normalized);
  }

  static low(): TaskPriority {
    return new TaskPriority(TASK_PRIORITY.LOW);
  }

  static medium(): TaskPriority {
    return new TaskPriority(TASK_PRIORITY.MEDIUM);
  }

  static high(): TaskPriority {
    return new TaskPriority(TASK_PRIORITY.HIGH);
  }

  static critical(): TaskPriority {
    return new TaskPriority(TASK_PRIORITY.CRITICAL);
  }

  get value(): TaskPriorityValue {
    return this.props.value;
  }

  isHigherThan(other: TaskPriority): boolean {
    return RANK[this.props.value] > RANK[other.props.value];
  }

  override toString(): string {
    return this.props.value;
  }
}

function isTaskPriorityValue(value: string): value is TaskPriorityValue {
  return Object.values(TASK_PRIORITY).some((priority) => priority === value);
}
