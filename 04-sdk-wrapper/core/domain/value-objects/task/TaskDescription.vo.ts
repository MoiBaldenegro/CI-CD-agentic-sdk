import { DomainValidationError } from "../../exceptions/DomainValidationError.js";
import { ValueObject } from "../ValueObject.js";

const MAX_LENGTH = 20_000;

interface TaskDescriptionProps extends Record<string, unknown> {
  readonly value: string;
}

export class TaskDescription extends ValueObject<TaskDescriptionProps> {
  private constructor(value: string) {
    super({ value });
  }

  static from(value: string): TaskDescription {
    const normalized = value.trim();

    if (normalized.length === 0) {
      throw new DomainValidationError(
        "TASK_DESCRIPTION_EMPTY",
        "Task description must not be empty",
      );
    }

    if (normalized.length > MAX_LENGTH) {
      throw new DomainValidationError(
        "TASK_DESCRIPTION_TOO_LONG",
        `Task description must be at most ${MAX_LENGTH} characters`,
        { length: normalized.length },
      );
    }

    return new TaskDescription(normalized);
  }

  get value(): string {
    return this.props.value;
  }

  override toString(): string {
    return this.props.value;
  }
}
