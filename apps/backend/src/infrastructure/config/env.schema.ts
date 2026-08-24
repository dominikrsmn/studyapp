import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),

  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().length(32),
  WEB_URL: z.url(),
  OPENAI_API_KEY: z.string(),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive(),
  REDIS_PASSWORD: z.string(),
  REDIS_USERNAME: z.string(),
  DOCLING_URL: z.url(),
  DOCLING_API_KEY: z.string(),
});

export type Env = z.infer<typeof envSchema>;
