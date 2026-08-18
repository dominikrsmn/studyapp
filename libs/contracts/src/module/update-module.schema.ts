import { z } from 'zod';
import { createModuleSchema } from './create-module.schema';

export const updateModuleSchema = createModuleSchema.partial();

export type UpdateModule = z.infer<typeof updateModuleSchema>;
