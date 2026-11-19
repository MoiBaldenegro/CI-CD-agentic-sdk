import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  DomainValidationError,
  InvalidStateTransitionError,
  TaskQueueUnavailableError,
} from 'lib/factory';

@Catch(
  DomainValidationError,
  InvalidStateTransitionError,
  TaskQueueUnavailableError,
)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(
    exception:
      | DomainValidationError
      | InvalidStateTransitionError
      | TaskQueueUnavailableError,
    host: ArgumentsHost,
  ): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const status = resolveStatus(exception);
    const code = resolveCode(exception);

    this.logger.warn(
      `${request.method} ${request.url} -> ${status} ${code}: ${exception.message}`,
    );

    response.status(status).json({
      statusCode: status,
      code,
      message: exception.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}

function resolveStatus(
  exception:
    | DomainValidationError
    | InvalidStateTransitionError
    | TaskQueueUnavailableError,
): number {
  if (exception instanceof DomainValidationError) {
    return HttpStatus.BAD_REQUEST;
  }

  if (exception instanceof TaskQueueUnavailableError) {
    return HttpStatus.SERVICE_UNAVAILABLE;
  }

  return HttpStatus.CONFLICT;
}

function resolveCode(
  exception:
    | DomainValidationError
    | InvalidStateTransitionError
    | TaskQueueUnavailableError,
): string {
  if (exception instanceof DomainValidationError) {
    return exception.code;
  }

  if (exception instanceof TaskQueueUnavailableError) {
    return exception.code;
  }

  return 'INVALID_STATE_TRANSITION';
}
