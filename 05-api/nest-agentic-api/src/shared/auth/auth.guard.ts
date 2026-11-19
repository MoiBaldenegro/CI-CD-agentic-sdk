import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { loginConfigured, readSession, safeEqual } from './session';

const IS_PUBLIC = 'isPublic';

/** Marca un endpoint como accesible sin autenticación. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Deja pasar si:
 * - el endpoint es @Public(), o
 * - hay sesión válida (login de la interfaz), o
 * - el header x-api-key coincide con API_KEY (scripts / curl).
 * Si no hay ni login ni API_KEY configurados, todo queda abierto
 * (solo seguro con HOST=127.0.0.1).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private readonly apiKey = process.env.API_KEY?.trim() || undefined;
  private readonly authEnabled = this.apiKey !== undefined || loginConfigured();

  constructor(private readonly reflector: Reflector) {
    if (!this.authEnabled) {
      this.logger.warn(
        'Sin API_KEY ni login configurados: los endpoints quedan sin autenticación',
      );
    }
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.authEnabled) {
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

    if (readSession(request) !== null) {
      return true;
    }

    const provided = request.header('x-api-key');
    if (
      this.apiKey !== undefined &&
      provided !== undefined &&
      safeEqual(provided, this.apiKey)
    ) {
      return true;
    }

    throw new UnauthorizedException(
      'Inicia sesión o envía un x-api-key válido',
    );
  }
}
