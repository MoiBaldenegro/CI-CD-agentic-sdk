import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

const IS_PUBLIC = 'isPublic';

/** Marca un endpoint como accesible sin API key. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Exige el header `x-api-key` igual a `API_KEY`.
 * Si `API_KEY` no está definido, deja pasar (solo seguro si HOST=127.0.0.1).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);
  private readonly apiKey = process.env.API_KEY?.trim() || undefined;

  constructor(private readonly reflector: Reflector) {
    if (this.apiKey === undefined) {
      this.logger.warn(
        'API_KEY no configurado: los endpoints quedan sin autenticación',
      );
    }
  }

  canActivate(context: ExecutionContext): boolean {
    if (this.apiKey === undefined) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header('x-api-key') ?? '';

    if (!safeEqual(provided, this.apiKey)) {
      throw new UnauthorizedException('x-api-key inválido o ausente');
    }

    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
