import { registerAs } from '@nestjs/config';

export const applicationConfig = registerAs('application', () => ({
  environment: (process.env['NODE_ENV'] ?? 'development') as
    'development' | 'production',
  globalPrefix: 'api',
  port: 3000,
}));
