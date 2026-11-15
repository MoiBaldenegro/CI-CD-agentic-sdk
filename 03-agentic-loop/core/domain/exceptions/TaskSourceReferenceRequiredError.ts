import { DomainException } from "../../../shared/DomainException.js";

export class TaskSourceReferenceRequiredError extends DomainException {
  readonly statusCode = 422;
  readonly source: string;

  constructor(source: string) {
    super("TASK_SOURCE_REF_REQUIRED", `Task source ${source} requires an external reference`, {
      source,
    });
    this.source = source;
  }
}
