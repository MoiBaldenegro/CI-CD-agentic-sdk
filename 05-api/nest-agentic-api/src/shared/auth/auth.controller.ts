import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from './auth.guard';
import { renderLoginPage } from './login.page';
import {
  clearSessionCookie,
  createSessionCookie,
  loginConfigured,
  readSession,
  verifyCredentials,
} from './session';

const MAX_FAILURES = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1_000;

@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly failures = new Map<
    string,
    { count: number; since: number }
  >();

  @Public()
  @Get('login')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  loginPage(): string {
    return renderLoginPage();
  }

  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.NO_CONTENT)
  login(
    @Body() body: { username?: unknown; password?: unknown },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): void {
    if (!loginConfigured()) {
      throw new ServiceUnavailableException(
        'Login no configurado: define APP_USERNAME y APP_PASSWORD_HASH',
      );
    }

    const ip = request.ip ?? 'unknown';
    this.assertNotLocked(ip);

    const username = typeof body?.username === 'string' ? body.username : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!verifyCredentials(username, password)) {
      this.registerFailure(ip);
      this.logger.warn(`Login fallido desde ${ip}`);
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    this.failures.delete(ip);
    createSessionCookie(response, request, username);
    this.logger.log(`Login correcto usuario=${username} ip=${ip}`);
  }

  @Public()
  @Post('auth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response): void {
    clearSessionCookie(response);
  }

  @Public()
  @Get('auth/me')
  me(@Req() request: Request) {
    return { user: readSession(request), loginEnabled: loginConfigured() };
  }

  private assertNotLocked(ip: string): void {
    const entry = this.failures.get(ip);
    if (entry === undefined) {
      return;
    }

    if (Date.now() - entry.since > LOCK_WINDOW_MS) {
      this.failures.delete(ip);
      return;
    }

    if (entry.count >= MAX_FAILURES) {
      throw new HttpException(
        'Demasiados intentos fallidos. Espera 15 minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private registerFailure(ip: string): void {
    const entry = this.failures.get(ip);
    if (entry === undefined || Date.now() - entry.since > LOCK_WINDOW_MS) {
      this.failures.set(ip, { count: 1, since: Date.now() });
      return;
    }
    entry.count += 1;
  }
}
