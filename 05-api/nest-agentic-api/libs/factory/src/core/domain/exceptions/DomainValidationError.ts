export class DomainValidationError extends Error {
  readonly code: string;
  readonly context: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: string,
    message: string,
    context?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'DomainValidationError';
    this.code = code;
    this.context = context;
  }
}
