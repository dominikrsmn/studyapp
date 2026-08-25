import { registerAs } from '@nestjs/config';

export const doclingConfig = registerAs('doclingConfig', () => ({
  timeout: 30000,
  retries: 5,
}));
