import { z } from 'zod';

export const userSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  email: z.string(),
  activeSemesterId: z.uuid().nullable()
})

export type UserDto = z.infer<typeof userSchema>;
