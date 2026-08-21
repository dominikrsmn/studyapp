import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),

  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().length(32),
  WEB_URL: z.url().default('http://localhost:4200'),

  OPENAI_API_KEY: z.string(),

  INGESTION_MAX_UPLOAD_BYTES: z.coerce.number().int().positive(),
  INGESTION_MAX_PAGES: z.coerce.number().int().positive(),
  INGESTION_MAX_TEXT_CHARACTERS: z.coerce.number().int().positive(),
  INGESTION_BATCH_SIZE: z.coerce.number().int().positive(),

  REDIS_HOST: z.ipv4(),
  REDIS_PORT: z.coerce.number().int().positive(),
  REDIS_PASSWORD: z.string(),
  REDIS_USERNAME: z.string(),
});

export type Env = z.infer<typeof envSchema>;
