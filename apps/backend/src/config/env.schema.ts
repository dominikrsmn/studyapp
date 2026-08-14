import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),

  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().length(32),
});

export type Env = z.infer<typeof envSchema>;
