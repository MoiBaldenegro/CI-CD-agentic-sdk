import { DomainError } from "./DomainError.js";

const ERROR_TYPE_BASE_URL = "https://errors.agentic-loop.dev";

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string | undefined;
  invalidParams?: Record<string, unknown> | undefined;
}

export abstract class DomainException extends DomainError {
  public abstract readonly statusCode: number;

  protected constructor(
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(code, message, details);
  }

  public toProblemDetails(instancePath?: string): ProblemDetails {
    return {
      type: `${ERROR_TYPE_BASE_URL}/${this.camelToKebabCase(this.name)}`,
      title: this.name,
      status: this.statusCode,
      detail: this.message,
      instance: instancePath,
      ...(this.details !== undefined && { invalidParams: { ...this.details } }),
    };
  }

  private camelToKebabCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter, index) =>
      index === 0 ? letter.toLowerCase() : `-${letter.toLowerCase()}`,
    );
  }
}
