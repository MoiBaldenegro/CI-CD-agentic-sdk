import { DomainException } from "./DomainException.js";

export class InvalidStateTransitionError extends DomainException {
  readonly statusCode = 409;
  readonly from: string;
  readonly to: string;

  constructor(from: string, to: string) {
    super("TASK_INVALID_STATE_TRANSITION", `Cannot transition task from ${from} to ${to}`, {
      from,
      to,
    });
    this.from = from;
    this.to = to;
  }
}
