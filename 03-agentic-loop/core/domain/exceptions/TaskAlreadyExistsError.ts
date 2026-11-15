import { DomainException } from "../../../shared/DomainException.js";

export class TaskAlreadyExistsError extends DomainException {
  readonly statusCode = 409;
  readonly source: string;
  readonly externalId: string;

  constructor(source: string, externalId: string) {
    super(
      "TASK_ALREADY_EXISTS",
      `A task for ${source} reference ${externalId} already exists`,
      { source, externalId },
    );
    this.source = source;
    this.externalId = externalId;
  }
}
