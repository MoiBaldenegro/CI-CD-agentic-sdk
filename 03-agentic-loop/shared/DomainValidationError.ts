import { DomainError } from "./DomainError.js";

export class DomainValidationError extends DomainError {
  readonly context: Readonly<Record<string, unknown>>;

  constructor(code: string, message: string, context: Readonly<Record<string, unknown>> = {}) {
    super(code, message);
    this.context = Object.freeze({ ...context });
  }
}
