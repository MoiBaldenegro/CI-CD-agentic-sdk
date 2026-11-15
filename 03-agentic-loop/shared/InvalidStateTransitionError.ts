import { DomainError } from "./DomainError.js";

export class InvalidStateTransitionError extends DomainError {
  readonly from: string;
  readonly to: string;

  constructor(from: string, to: string) {
    super("TASK_INVALID_STATE_TRANSITION", `Cannot transition task from ${from} to ${to}`);
    this.from = from;
    this.to = to;
  }
}
