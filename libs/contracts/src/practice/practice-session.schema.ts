import { z } from 'zod';
import { observationSchema } from '../assessment/observation.schema';

export const practiceQuestionSchema = z.object({
  id: z.uuid(),
  topicId: z.uuid(),
  contentRevision: z.number().int().positive(),
  prompt: z.string().min(1),
});

const session = { id: z.uuid(), moduleId: z.uuid() };

// Only the answering state exposes a question; feedback exposes the assessed fact.
export const practiceSessionResponseSchema = z.discriminatedUnion('status', [
  z.object({ ...session, status: z.literal('preparing') }),
  z.object({
    ...session,
    status: z.literal('answering'),
    question: practiceQuestionSchema,
  }),
  z.object({
    ...session,
    status: z.literal('assessing'),
    attemptId: z.uuid(),
  }),
  z
    .object({
      ...session,
      status: z.literal('feedback'),
      observation: observationSchema,
    })
    .refine(
      (value) =>
        value.observation.sessionId === value.id &&
        value.observation.moduleId === value.moduleId,
      { message: 'Observation must belong to this session and module' },
    ),
  z.object({
    ...session,
    status: z.literal('completed'),
    completedAt: z.iso.datetime(),
    observationCount: z.number().int().nonnegative(),
  }),
  z.object({ ...session, status: z.literal('failed'), message: z.string() }),
]);

export type PracticeQuestion = z.infer<typeof practiceQuestionSchema>;
export type PracticeSessionResponse = z.infer<
  typeof practiceSessionResponseSchema
>;
