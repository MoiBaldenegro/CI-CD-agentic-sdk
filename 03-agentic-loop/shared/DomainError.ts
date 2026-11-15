export interface DomainErrorPayload {
  name: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  occurredAt: string;
}

export abstract class DomainError extends Error {
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>> | undefined;
  readonly occurredAt: Date;

  protected constructor(
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details === undefined ? undefined : Object.freeze({ ...details });
    this.occurredAt = new Date();
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): DomainErrorPayload {
    const payload: DomainErrorPayload = {
      name: this.name,
      code: this.code,
      message: this.message,
      occurredAt: this.occurredAt.toISOString(),
    };

    if (this.details !== undefined) {
      payload.details = { ...this.details };
    }

    return payload;
  }
}
