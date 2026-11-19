import { DomainValidationError } from '../../exceptions/DomainValidationError.js';
import { ValueObject } from '../ValueObject.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface TaskIdProps extends Record<string, unknown> {
  readonly value: string;
}

export class TaskId extends ValueObject<TaskIdProps> {
  private constructor(value: string) {
    super({ value });
  }

  static generate(): TaskId {
    return new TaskId(globalThis.crypto.randomUUID());
  }

  static from(value: string): TaskId {
    const normalized = value.trim();

    if (!UUID_PATTERN.test(normalized)) {
      throw new DomainValidationError(
        'TASK_ID_INVALID',
        'Task id must be a valid UUID',
        {
          value,
        },
      );
    }

    return new TaskId(normalized.toLowerCase());
  }

  get value(): string {
    return this.props.value;
  }

  override toString(): string {
    return this.props.value;
  }
}
