import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  host: process.env['REDIS_HOST'] as string,
  port: Number(process.env['REDIS_PORT']),
  username: process.env['REDIS_USERNAME'] as string,
  password: process.env['REDIS_PASSWORD'] as string,
}));
