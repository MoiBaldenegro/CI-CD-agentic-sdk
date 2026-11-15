import { DomainValidationError } from "../../../shared/DomainValidationError.js";
import { ValueObject } from "../../../shared/ValueObject.js";

const MAX_LENGTH = 200;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

interface TaskTitleProps extends Record<string, unknown> {
  readonly value: string;
}

export class TaskTitle extends ValueObject<TaskTitleProps> {
  private constructor(value: string) {
    super({ value });
  }

  static from(value: string): TaskTitle {
    const normalized = value.trim();

    if (normalized.length === 0) {
      throw new DomainValidationError("TASK_TITLE_EMPTY", "Task title must not be empty");
    }

    if (normalized.length > MAX_LENGTH) {
      throw new DomainValidationError(
        "TASK_TITLE_TOO_LONG",
        `Task title must be at most ${MAX_LENGTH} characters`,
        { length: normalized.length },
      );
    }

    if (CONTROL_CHARACTERS.test(normalized)) {
      throw new DomainValidationError(
        "TASK_TITLE_INVALID_CHARACTERS",
        "Task title must not contain control characters",
      );
    }

    return new TaskTitle(normalized);
  }

  get value(): string {
    return this.props.value;
  }

  override toString(): string {
    return this.props.value;
  }
}
