import { DomainValidationError } from "../../exceptions/DomainValidationError.js";
import { ValueObject } from "../ValueObject.js";

const MAX_ENTRIES = 50;
const MAX_KEY_LENGTH = 64;
const MAX_VALUE_LENGTH = 2_000;
const KEY_PATTERN = /^[A-Za-z0-9_.-]+$/;

interface TaskMetadataProps extends Record<string, unknown> {
  readonly entries: Readonly<Record<string, string>>;
}

export class TaskMetadata extends ValueObject<TaskMetadataProps> {
  private constructor(entries: Readonly<Record<string, string>>) {
    super({ entries: Object.freeze({ ...entries }) });
  }

  static empty(): TaskMetadata {
    return new TaskMetadata({});
  }

  static from(entries: Readonly<Record<string, string>>): TaskMetadata {
    const normalizedEntries = Object.entries(entries);

    if (normalizedEntries.length > MAX_ENTRIES) {
      throw new DomainValidationError(
        "TASK_METADATA_TOO_MANY_ENTRIES",
        `Task metadata must have at most ${MAX_ENTRIES} entries`,
        { count: normalizedEntries.length },
      );
    }

    const normalized: Record<string, string> = {};

    for (const [key, value] of normalizedEntries) {
      if (key.length === 0 || key.length > MAX_KEY_LENGTH || !KEY_PATTERN.test(key)) {
        throw new DomainValidationError("TASK_METADATA_INVALID_KEY", "Task metadata key is invalid", {
          key,
        });
      }

      if (typeof value !== "string" || value.length > MAX_VALUE_LENGTH) {
        throw new DomainValidationError(
          "TASK_METADATA_INVALID_VALUE",
          `Task metadata values must be strings of at most ${MAX_VALUE_LENGTH} characters`,
          { key },
        );
      }

      normalized[key] = value;
    }

    return new TaskMetadata(normalized);
  }

  get entries(): Readonly<Record<string, string>> {
    return this.props.entries;
  }

  get(key: string): string | undefined {
    return this.props.entries[key];
  }

  with(key: string, value: string): TaskMetadata {
    return TaskMetadata.from({ ...this.props.entries, [key]: value });
  }
}
