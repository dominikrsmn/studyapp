import { z } from 'zod';

// Assessment facts are append-only; they never contain mastery estimates.
export const observationSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  moduleId: z.uuid(),
  topicId: z.uuid(),
  contentRevision: z.number().int().positive(),
  sessionId: z.uuid(),
  attemptId: z.uuid(),
  occurredAt: z.iso.datetime(),
  score: z.number().min(0).max(1),
  feedback: z.string(),
});

export type Observation = z.infer<typeof observationSchema>;
