import { CookieOptions } from 'express';

export const REFRESH_TOKEN_COOKIE = 'studyapp_refresh';

const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function baseRefreshTokenCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/auth',
  };
}

export function refreshTokenCookieOptions(
  isProduction: boolean,
): CookieOptions {
  return {
    ...baseRefreshTokenCookieOptions(isProduction),
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  };
}

export function clearRefreshTokenCookieOptions(
  isProduction: boolean,
): CookieOptions {
  return baseRefreshTokenCookieOptions(isProduction);
}
