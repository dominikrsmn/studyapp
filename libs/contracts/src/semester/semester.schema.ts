import { z } from 'zod';

export const semesterSchema = z.object({
  id: z.uuid(),
  startDate: z.iso.datetime(),
  endDate: z.iso.datetime(),
});

export type SemesterDto = z.infer<typeof semesterSchema>;
