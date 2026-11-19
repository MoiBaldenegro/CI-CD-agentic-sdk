import { Logger } from '@nestjs/common';
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import type { Request, Response } from 'express';

export const SESSION_COOKIE = 'factory_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1_000;

let generatedSecret: string | null = null;

function sessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) {
    return configured;
  }

  if (generatedSecret === null) {
    generatedSecret = randomBytes(32).toString('hex');
    new Logger('Auth').warn(
      'SESSION_SECRET no configurado: se generó uno temporal (las sesiones se pierden al reiniciar)',
    );
  }

  return generatedSecret;
}

/** El login está activo si hay usuario y hash de contraseña configurados. */
export function loginConfigured(): boolean {
  return Boolean(
    process.env.APP_USERNAME?.trim() && process.env.APP_PASSWORD_HASH?.trim(),
  );
}

export function verifyCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.APP_USERNAME?.trim() ?? '';
  const stored = process.env.APP_PASSWORD_HASH?.trim() ?? '';

  // Se calcula el hash siempre para no revelar por tiempo si el usuario existe.
  const passwordOk = verifyPassword(password, stored);
  const userOk = safeEqual(username, expectedUser);

  return expectedUser.length > 0 && userOk && passwordOk;
}

/** Formato: scrypt$<salt base64>$<hash base64> */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) {
    scryptSync(password, 'dummy-salt', 64);
    return false;
  }

  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(password, Buffer.from(saltB64, 'base64'), 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSessionCookie(
  response: Response,
  request: Request,
  username: string,
): void {
  const payload = Buffer.from(
    JSON.stringify({ u: username, exp: Date.now() + SESSION_TTL_MS }),
  ).toString('base64url');
  const value = `${payload}.${sign(payload)}`;

  response.cookie(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: 'strict',
    secure: request.secure || process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Devuelve el usuario de la sesión o null si no hay sesión válida. */
export function readSession(request: Request): string | null {
  const raw = readCookie(request, SESSION_COOKIE);
  if (raw === null) {
    return null;
  }

  const [payload, signature] = raw.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as { u?: unknown; exp?: unknown };

    if (typeof data.u !== 'string' || typeof data.exp !== 'number') {
      return null;
    }

    return data.exp > Date.now() ? data.u : null;
  } catch {
    return null;
  }
}

function sign(payload: string): string {
  return createHmac('sha256', sessionSecret())
    .update(payload)
    .digest('base64url');
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.cookie;
  if (!header) {
    return null;
  }

  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return null;
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
