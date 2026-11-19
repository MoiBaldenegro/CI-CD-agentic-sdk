import type { Request, Response } from 'express';
import {
  createSessionCookie,
  hashPassword,
  readSession,
  SESSION_COOKIE,
  verifyCredentials,
  verifyPassword,
} from '../session';

describe('passwords', () => {
  it('verifica el hash correcto y rechaza otros', () => {
    const stored = hashPassword('una-clave-larga');
    expect(verifyPassword('una-clave-larga', stored)).toBe(true);
    expect(verifyPassword('otra-clave', stored)).toBe(false);
    expect(verifyPassword('una-clave-larga', 'basura')).toBe(false);
  });

  it('verifyCredentials exige usuario y contraseña', () => {
    process.env.APP_USERNAME = 'moises';
    process.env.APP_PASSWORD_HASH = hashPassword('una-clave-larga');
    expect(verifyCredentials('moises', 'una-clave-larga')).toBe(true);
    expect(verifyCredentials('otro', 'una-clave-larga')).toBe(false);
    expect(verifyCredentials('moises', 'mala')).toBe(false);
  });
});

describe('session cookie', () => {
  beforeAll(() => {
    process.env.SESSION_SECRET = 'secreto-de-prueba';
  });

  function issue(user: string): string {
    let value = '';
    const response = {
      cookie: (_name: string, v: string) => {
        value = v;
      },
    } as unknown as Response;
    createSessionCookie(response, { secure: false } as Request, user);
    return value;
  }

  function requestWith(value: string): Request {
    return {
      headers: {
        cookie: `otra=1; ${SESSION_COOKIE}=${encodeURIComponent(value)}`,
      },
    } as Request;
  }

  it('lee una sesión válida', () => {
    expect(readSession(requestWith(issue('moises')))).toBe('moises');
  });

  it('rechaza una sesión alterada', () => {
    const [payload, signature] = issue('moises').split('.');
    const forged = Buffer.from(
      JSON.stringify({ u: 'admin', exp: Date.now() + 1e9 }),
    ).toString('base64url');
    expect(readSession(requestWith(`${forged}.${signature}`))).toBeNull();
    expect(readSession(requestWith(`${payload}.x`))).toBeNull();
  });

  it('sin cookie no hay sesión', () => {
    expect(readSession({ headers: {} } as Request)).toBeNull();
  });
});
