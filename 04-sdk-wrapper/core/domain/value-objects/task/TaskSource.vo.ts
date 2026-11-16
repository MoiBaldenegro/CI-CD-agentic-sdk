import { DomainValidationError } from "../../exceptions/DomainValidationError.js";
import { ValueObject } from "../ValueObject.js";

export const TASK_SOURCE = {
  MANUAL: "MANUAL",
  CLI: "CLI",
  API: "API",
  WEBHOOK: "WEBHOOK",
  GITHUB_ISSUE: "GITHUB_ISSUE",
  GITLAB_ISSUE: "GITLAB_ISSUE",
  JIRA_ISSUE: "JIRA_ISSUE",
  SLACK: "SLACK",
} as const;

export type TaskSourceValue = (typeof TASK_SOURCE)[keyof typeof TASK_SOURCE];

const SOURCES_REQUIRING_REFERENCE: readonly TaskSourceValue[] = [
  TASK_SOURCE.GITHUB_ISSUE,
  TASK_SOURCE.GITLAB_ISSUE,
  TASK_SOURCE.JIRA_ISSUE,
];

interface TaskSourceProps extends Record<string, unknown> {
  readonly value: TaskSourceValue;
}

export class TaskSource extends ValueObject<TaskSourceProps> {
  private constructor(value: TaskSourceValue) {
    super({ value });
  }

  static from(value: string): TaskSource {
    const normalized = value.trim().toUpperCase();

    if (!isTaskSourceValue(normalized)) {
      throw new DomainValidationError(
        "TASK_SOURCE_INVALID",
        `Task source must be one of: ${Object.values(TASK_SOURCE).join(", ")}`,
        { value },
      );
    }

    return new TaskSource(normalized);
  }

  static githubIssue(): TaskSource {
    return new TaskSource(TASK_SOURCE.GITHUB_ISSUE);
  }

  static manual(): TaskSource {
    return new TaskSource(TASK_SOURCE.MANUAL);
  }

  get value(): TaskSourceValue {
    return this.props.value;
  }

  isExternalIssue(): boolean {
    return SOURCES_REQUIRING_REFERENCE.includes(this.props.value);
  }

  override toString(): string {
    return this.props.value;
  }
}

function isTaskSourceValue(value: string): value is TaskSourceValue {
  return Object.values(TASK_SOURCE).some((source) => source === value);
}
