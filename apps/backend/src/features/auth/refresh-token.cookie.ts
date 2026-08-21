import { CookieOptions } from 'express';
import { ConfigType } from '@nestjs/config';
import { authConfig } from './auth.config';

function baseRefreshTokenCookieOptions(
  isProduction: boolean,
  config: ConfigType<typeof authConfig>,
): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: config.refreshTokenCookie.sameSite,
    path: config.refreshTokenCookie.path,
  };
}

export function refreshTokenCookieOptions(
  isProduction: boolean,
  config: ConfigType<typeof authConfig>,
): CookieOptions {
  return {
    ...baseRefreshTokenCookieOptions(isProduction, config),
    maxAge: config.refreshTokenCookie.maxAgeMs,
  };
}

export function clearRefreshTokenCookieOptions(
  isProduction: boolean,
  config: ConfigType<typeof authConfig>,
): CookieOptions {
  return baseRefreshTokenCookieOptions(isProduction, config);
}
