export class InvalidStateTransitionError extends Error {
  constructor(currentStatus: string, nextStatus: string) {
    super(`Invalid task status transition from ${currentStatus} to ${nextStatus}`);
    this.name = "InvalidStateTransitionError";
  }
}
