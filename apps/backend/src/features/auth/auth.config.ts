import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  jwtSecret: process.env['JWT_SECRET'] as string,
  issuer: 'studyapp',
  audiences: {
    access: 'studyapp-api',
    refresh: 'studyapp-refresh',
    magicLink: 'studyapp-magic-link',
  },
  accessTokenTtlSeconds: 60,
  refreshTokenTtlSeconds: 2_592_000,
  magicLinkTtlSeconds: 600,
  refreshRotationGraceMs: 5_000,
  refreshTokenCookie: {
    name: 'studyapp_refresh',
    maxAgeMs: 2_592_000_000,
    path: '/api/auth',
    sameSite: 'strict' as const,
  },
  webUrl: process.env['WEB_URL'] as string,
  magicLinkVerificationPath: '/auth/verify',
}));
