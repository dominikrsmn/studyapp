import { z } from 'zod';

export const createSemesterSchema = z
  .object({
    startDate: z.iso.datetime(),
    endDate: z.iso.datetime(),
  })
  .refine(
    ({ startDate, endDate }) => new Date(startDate) <= new Date(endDate),
    { message: 'End date must not be before start date', path: ['endDate'] },
  );

export type CreateSemester = z.infer<typeof createSemesterSchema>;
