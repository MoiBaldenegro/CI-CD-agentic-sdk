import { DomainException } from "./DomainException.js";

export class DomainValidationError extends DomainException {
  readonly statusCode = 422;
  readonly context: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: string,
    message: string,
    context?: Readonly<Record<string, unknown>>,
  ) {
    super(code, message, context);
    this.context = this.details;
  }
}
