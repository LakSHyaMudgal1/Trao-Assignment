import type { Response, CookieOptions } from 'express';
import { env } from '../config/env.js';

export const AUTH_COOKIE_NAME = 'auth_token';

export const AUTH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: 0,
  });
}
