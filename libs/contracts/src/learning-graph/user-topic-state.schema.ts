import { z } from 'zod';

const scope = {
  userId: z.uuid(),
  topicId: z.uuid(),
  contentRevision: z.number().int().positive(),
};

// A rebuildable projection owned by LearningGraph, scoped to a content revision.
export const userTopicStateSchema = z.discriminatedUnion('status', [
  z.object({ ...scope, status: z.literal('unobserved') }),
  z.object({
    ...scope,
    status: z.literal('observed'),
    mastery: z.number().min(0).max(1),
    observationCount: z.number().int().positive(),
    lastObservationId: z.uuid(),
    updatedAt: z.iso.datetime(),
  }),
]);

export type UserTopicState = z.infer<typeof userTopicStateSchema>;
