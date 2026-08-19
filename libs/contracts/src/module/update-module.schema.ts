import { z } from 'zod';
import { createModuleSchema } from './create-module.schema';
import { dateOnlySchema } from '../util/date-only';

export const updateModuleSchema = createModuleSchema.partial().extend({
  examDate: dateOnlySchema.nullable().optional(),
});
export type UpdateModule = z.infer<typeof updateModuleSchema>;
